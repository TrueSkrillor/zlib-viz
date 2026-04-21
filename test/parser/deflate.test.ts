import { describe, expect, it } from 'vitest';
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
