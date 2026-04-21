import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { BitReader } from '../../src/parser/bit-reader';
import { parseGzip } from '../../src/parser/gzip-frame';

describe('parseGzip', () => {
  it('parses a plain gzip stream, decodes the body, and validates CRC32 + ISIZE', () => {
    const input = Buffer.from('gzip round-trip '.repeat(50));
    const compressed = gzipSync(input);
    const result = parseGzip(new BitReader(new Uint8Array(compressed)));
    expect(result.errors).toEqual([]);
    expect(Buffer.from(result.decoded).equals(input)).toBe(true);
    expect(result.wrapper?.kind).toBe('gzip');
    expect(result.trailer?.kind).toBe('gzip-trailer');
    if (result.trailer?.kind === 'gzip-trailer') {
      expect(result.trailer.crc32.valid).toBe(true);
      expect(result.trailer.isize.valid).toBe(true);
    }
  });

  it('reads FNAME when FLG.FNAME bit is set', () => {
    const payload = Buffer.from('abc');
    const raw = gzipSync(payload);
    const body = raw.subarray(10);
    const filename = Buffer.from('hello.txt\x00');
    const header = Buffer.from([0x1f, 0x8b, 0x08, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff]);
    const combined = Buffer.concat([header, filename, body]);
    const result = parseGzip(new BitReader(new Uint8Array(combined)));
    expect(result.wrapper?.kind).toBe('gzip');
    if (result.wrapper?.kind === 'gzip') expect(result.wrapper.fname?.value).toBe('hello.txt');
    expect(Buffer.from(result.decoded).equals(payload)).toBe(true);
  });
});
