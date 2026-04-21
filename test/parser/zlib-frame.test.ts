import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { BitReader } from '../../src/parser/bit-reader';
import { parseZlib } from '../../src/parser/zlib-frame';

describe('parseZlib', () => {
  it('parses the zlib wrapper, decodes the body, and validates ADLER32', () => {
    const input = Buffer.from('Hello, world! '.repeat(100));
    const compressed = deflateSync(input);
    const r = new BitReader(new Uint8Array(compressed));
    const result = parseZlib(r);
    expect(result.errors).toEqual([]);
    expect(Buffer.from(result.decoded).equals(input)).toBe(true);
    expect(result.wrapper?.kind).toBe('zlib');
    if (result.wrapper?.kind === 'zlib') {
      expect(result.wrapper.cmf.cm).toBe(8);
    }
    expect(result.trailer?.kind).toBe('adler32');
    if (result.trailer?.kind === 'adler32') {
      expect(result.trailer.valid).toBe(true);
    }
  });

  it('flags a soft error when ADLER32 mismatches', () => {
    const input = Buffer.from('abc');
    const compressed = new Uint8Array(deflateSync(input));
    compressed[compressed.length - 1] ^= 0xff;
    const result = parseZlib(new BitReader(compressed));
    const softs = result.errors.filter(e => e.severity === 'soft');
    expect(softs.some(e => /adler/i.test(e.message))).toBe(true);
    expect(result.trailer?.kind).toBe('adler32');
    if (result.trailer?.kind === 'adler32') expect(result.trailer.valid).toBe(false);
  });
});
