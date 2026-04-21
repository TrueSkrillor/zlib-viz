import { describe, expect, it } from 'vitest';
import { BitReader } from '../../src/parser/bit-reader';

describe('BitReader', () => {
  it('reads LSB-first within a byte', () => {
    // 0b10110100 — bit 0 (LSB) = 0, bit 7 (MSB) = 1.
    const r = new BitReader(new Uint8Array([0b10110100]));
    expect(r.readBits(1)).toBe(0);  // bit 0
    expect(r.readBits(1)).toBe(0);  // bit 1
    expect(r.readBits(1)).toBe(1);  // bit 2
    expect(r.readBits(1)).toBe(0);  // bit 3
    expect(r.readBits(4)).toBe(0b1011); // bits 4..7, LSB-first → value is bit4|bit5<<1|bit6<<2|bit7<<3
  });

  it('reads multi-byte values LSB-first across byte boundaries', () => {
    // bytes [0xCD, 0xAB] → as a 16-bit LSB-first value: 0xABCD.
    const r = new BitReader(new Uint8Array([0xCD, 0xAB]));
    expect(r.readBits(16)).toBe(0xABCD);
    expect(r.eof()).toBe(true);
  });

  it('tracks bitPos monotonically', () => {
    const r = new BitReader(new Uint8Array([0xFF, 0xFF]));
    expect(r.bitPos).toBe(0);
    r.readBits(3);
    expect(r.bitPos).toBe(3);
    r.readBits(10);
    expect(r.bitPos).toBe(13);
  });

  it('peek does not advance', () => {
    const r = new BitReader(new Uint8Array([0xA5]));
    expect(r.peek(4)).toBe(0x5);
    expect(r.bitPos).toBe(0);
    r.advance(4);
    expect(r.bitPos).toBe(4);
    expect(r.peek(4)).toBe(0xA);
  });

  it('alignToByte rounds up to the next byte boundary', () => {
    const r = new BitReader(new Uint8Array([0x00, 0xAA]));
    r.readBits(3);
    r.alignToByte();
    expect(r.bitPos).toBe(8);
    expect(r.readBits(8)).toBe(0xAA);
  });

  it('readBytes returns byte-aligned slice and advances bitPos', () => {
    const r = new BitReader(new Uint8Array([0x11, 0x22, 0x33, 0x44]));
    r.alignToByte();
    const out = r.readBytes(3);
    expect(Array.from(out)).toEqual([0x11, 0x22, 0x33]);
    expect(r.bitPos).toBe(24);
  });

  it('eof is true once all bits consumed', () => {
    const r = new BitReader(new Uint8Array([0xFF]));
    r.readBits(8);
    expect(r.eof()).toBe(true);
  });

  it('throws when reading past EOF', () => {
    const r = new BitReader(new Uint8Array([0x01]));
    r.readBits(8);
    expect(() => r.readBits(1)).toThrow(/past EOF/);
  });

  it('rejects readBits n outside 1..16', () => {
    const r = new BitReader(new Uint8Array([0xFF, 0xFF, 0xFF]));
    expect(() => r.readBits(0)).toThrow();
    expect(() => r.readBits(17)).toThrow();
  });

  it('readBytes throws if not byte-aligned', () => {
    const r = new BitReader(new Uint8Array([0x00, 0x01]));
    r.readBits(3);
    expect(() => r.readBytes(1)).toThrow(/aligned/);
  });

  it('advance throws past EOF', () => {
    const r = new BitReader(new Uint8Array([0xFF]));
    expect(() => r.advance(9)).toThrow(/past EOF/);
  });

  it('advance rejects negative n', () => {
    const r = new BitReader(new Uint8Array([0xFF, 0xFF]));
    r.readBits(4);
    expect(() => r.advance(-1)).toThrow(/>= 0/);
  });

  it('readBytes rejects negative n', () => {
    const r = new BitReader(new Uint8Array([0x11, 0x22]));
    expect(() => r.readBytes(-1)).toThrow(/>= 0/);
  });

  it('peek rejects n outside 1..16', () => {
    const r = new BitReader(new Uint8Array([0xFF, 0xFF]));
    expect(() => r.peek(0)).toThrow();
    expect(() => r.peek(17)).toThrow();
  });

  it('empty input reports eof and throws on any read', () => {
    const r = new BitReader(new Uint8Array([]));
    expect(r.eof()).toBe(true);
    expect(() => r.readBits(1)).toThrow(/past EOF/);
    expect(() => r.peek(1)).toThrow(/past EOF/);
  });
});
