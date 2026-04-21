import { describe, expect, it } from 'vitest';
import { BitReader } from '../../src/parser/bit-reader';
import { buildHuffmanTable, decodeSymbol } from '../../src/parser/huffman';
import { FIXED_LITLEN_LENGTHS, FIXED_DIST_LENGTHS } from '../../src/parser/constants';

describe('buildHuffmanTable', () => {
  it('builds a canonical table from a simple length array', () => {
    const t = buildHuffmanTable([2, 1, 3, 3]);
    expect(t.maxBits).toBe(3);
    const byCode = new Map(t.symbolsByCode.map(x => [x.symbol, x]));
    expect(byCode.get(1)).toEqual({ symbol: 1, bits: 1, code: 0b0 });
    expect(byCode.get(0)).toEqual({ symbol: 0, bits: 2, code: 0b10 });
    expect(byCode.get(2)).toEqual({ symbol: 2, bits: 3, code: 0b110 });
    expect(byCode.get(3)).toEqual({ symbol: 3, bits: 3, code: 0b111 });
  });

  it('rejects a length array that violates Kraft inequality', () => {
    expect(() => buildHuffmanTable([1, 1, 1])).toThrow(/over-subscribed/i);
  });

  it('allows length 0 symbols (unused)', () => {
    const t = buildHuffmanTable([0, 1, 1]);
    expect(t.symbolsByCode.map(x => x.symbol).sort()).toEqual([1, 2]);
  });

  it('builds the RFC 1951 fixed lit/len table with max depth 9', () => {
    const t = buildHuffmanTable(FIXED_LITLEN_LENGTHS);
    expect(t.maxBits).toBe(9);
  });

  it('builds the RFC 1951 fixed distance table with max depth 5', () => {
    const t = buildHuffmanTable(FIXED_DIST_LENGTHS);
    expect(t.maxBits).toBe(5);
  });
});

describe('decodeSymbol', () => {
  it('round-trips canonical codes encoded LSB-first', () => {
    const t = buildHuffmanTable([2, 1, 3, 3]);
    const bits: number[] = [];
    const pushCode = (code: number, nBits: number) => {
      for (let i = nBits - 1; i >= 0; i--) bits.push((code >> i) & 1);
    };
    pushCode(0b0,   1);
    pushCode(0b10,  2);
    pushCode(0b110, 3);
    pushCode(0b111, 3);
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < bits.length; i++) bytes[i >> 3] |= bits[i] << (i & 7);

    const r = new BitReader(bytes);
    expect(decodeSymbol(r, t)).toBe(1);
    expect(decodeSymbol(r, t)).toBe(0);
    expect(decodeSymbol(r, t)).toBe(2);
    expect(decodeSymbol(r, t)).toBe(3);
  });
});
