import { describe, expect, it } from 'vitest';
import { deflateRawSync, constants as zlibConstants } from 'node:zlib';
import { BitReader } from '../../src/parser/bit-reader';
import { parseDeflate } from '../../src/parser/deflate';

function assembleStored(payload: Uint8Array, bfinal = true): Uint8Array {
  const header = new Uint8Array(1);
  header[0] = bfinal ? 0b001 : 0b000;
  const len = payload.length;
  const nlen = (~len) & 0xffff;
  const lenBytes = new Uint8Array([len & 0xff, (len >> 8) & 0xff, nlen & 0xff, (nlen >> 8) & 0xff]);
  const out = new Uint8Array(header.length + lenBytes.length + payload.length);
  out.set(header, 0);
  out.set(lenBytes, header.length);
  out.set(payload, header.length + lenBytes.length);
  return out;
}

describe('parseDeflate — stored blocks', () => {
  it('decodes a single BFINAL=1 stored block', () => {
    const payload = new TextEncoder().encode('hello');
    const bytes = assembleStored(payload, true);
    const result = parseDeflate(new BitReader(bytes));
    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    const b = result.blocks[0];
    expect(b.btype).toBe('stored');
    expect(b.bfinal).toBe(true);
    expect(Array.from(result.decoded)).toEqual(Array.from(payload));
    expect(b.outputRange).toEqual({ start: 0, end: 5 });
    expect(b.headerRange).toEqual({ start: 0, end: 3 });
    expect(b.body.kind).toBe('stored');
    if (b.body.kind === 'stored') {
      expect(Array.from(b.body.bytes)).toEqual(Array.from(payload));
      expect(b.body.lenRange).toEqual({ start: 8, end: 24 });
      expect(b.body.nlenRange).toEqual({ start: 24, end: 40 });
      expect(b.body.payloadRange).toEqual({ start: 40, end: 40 + 5 * 8 });
    }
  });

  it('decodes multiple stored blocks', () => {
    const a = new TextEncoder().encode('AB');
    const b = new TextEncoder().encode('CDE');
    const firstBytes = assembleStored(a, false);
    const secondBytes = assembleStored(b, true);
    const combined = new Uint8Array(firstBytes.length + secondBytes.length);
    combined.set(firstBytes, 0);
    combined.set(secondBytes, firstBytes.length);
    const result = parseDeflate(new BitReader(combined));
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].bfinal).toBe(false);
    expect(result.blocks[1].bfinal).toBe(true);
    expect(new TextDecoder().decode(result.decoded)).toBe('ABCDE');
  });

  it('reports a fatal error when LEN != ~NLEN', () => {
    const bytes = new Uint8Array([
      0b001,
      0x02, 0x00,
      0x00, 0x00,
      0x41, 0x42,
    ]);
    const result = parseDeflate(new BitReader(bytes));
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].severity).toBe('fatal');
    expect(result.errors[0].message).toMatch(/LEN/i);
  });
});

describe('parseDeflate — fixed Huffman blocks', () => {
  it('round-trips a literal-only payload', () => {
    const input = new TextEncoder().encode('Hello, world!');
    const compressed = deflateRawSync(Buffer.from(input), { strategy: zlibConstants.Z_FIXED });
    const result = parseDeflate(new BitReader(new Uint8Array(compressed)));
    expect(result.errors).toEqual([]);
    expect(new TextDecoder().decode(result.decoded)).toBe('Hello, world!');
    expect(result.blocks[0].btype).toBe('fixed');
    const body = result.blocks[0].body;
    expect(body.kind).toBe('huffman');
    if (body.kind === 'huffman') {
      expect(body.symbols.at(-1)?.kind).toBe('end-of-block');
      expect(body.symbols.filter(s => s.kind === 'literal')).toHaveLength(input.length);
    }
  });

  it('round-trips a payload that uses back-references', () => {
    const repeated = 'abcabcabcabcabcabcabcabc';
    const compressed = deflateRawSync(Buffer.from(repeated), { strategy: zlibConstants.Z_FIXED });
    const result = parseDeflate(new BitReader(new Uint8Array(compressed)));
    expect(new TextDecoder().decode(result.decoded)).toBe(repeated);
    const body = result.blocks[0].body;
    if (body.kind === 'huffman') {
      const matches = body.symbols.filter(s => s.kind === 'match');
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) {
        if (m.kind !== 'match') continue;
        expect(m.length).toBeGreaterThanOrEqual(3);
        expect(m.length).toBeLessThanOrEqual(258);
        expect(m.distance).toBeGreaterThanOrEqual(1);
        expect(m.backrefEnd - m.backrefStart).toBe(m.length);
        expect(m.outputEnd - m.outputStart).toBe(m.length);
      }
    }
  });
});

describe('parseDeflate — dynamic Huffman blocks', () => {
  it('round-trips a realistic payload and produces dynamicMeta', () => {
    const input = Buffer.from(
      'the quick brown fox jumps over the lazy dog '.repeat(30) +
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(30),
    );
    const compressed = deflateRawSync(input, { level: 9 });
    const result = parseDeflate(new BitReader(new Uint8Array(compressed)));
    expect(result.errors).toEqual([]);
    expect(Buffer.from(result.decoded).equals(input)).toBe(true);
    const dynBlocks = result.blocks.filter(b => b.btype === 'dynamic');
    expect(dynBlocks.length).toBeGreaterThan(0);
    for (const b of dynBlocks) {
      if (b.body.kind !== 'huffman' || !b.body.dynamicMeta) continue;
      const m = b.body.dynamicMeta;
      expect(m.hlit).toBeGreaterThanOrEqual(0);
      expect(m.hdist).toBeGreaterThanOrEqual(0);
      expect(m.hclen).toBeGreaterThanOrEqual(0);
      expect(m.codeLenCodeLengths).toHaveLength(m.hclen + 4);
      const litlenExpanded = m.litlenLengths.flatMap(e => e.expandedLengths);
      expect(litlenExpanded.length).toBe(m.hlit + 257);
      const distExpanded = m.distLengths.flatMap(e => e.expandedLengths);
      expect(distExpanded.length).toBe(m.hdist + 1);
    }
  });
});
