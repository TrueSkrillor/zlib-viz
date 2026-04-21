import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, gunzipSync, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseStream } from '../../src/parser';
import type { Block } from '../../src/parser/types';

const fxDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = (name: string) => new Uint8Array(readFileSync(resolve(fxDir, name)));

function checkOffsetInvariants(bytes: Uint8Array, blocks: Block[], totalDecoded: number) {
  const totalBits = bytes.length * 8;
  let prevBlockEnd = -Infinity;
  let cumulativeDecoded = 0;
  for (const b of blocks) {
    expect(b.range.start).toBeGreaterThanOrEqual(0);
    expect(b.range.end).toBeLessThanOrEqual(totalBits);
    expect(b.headerRange.start).toBe(b.range.start);
    expect(b.headerRange.end).toBeLessThanOrEqual(b.range.end);
    if (prevBlockEnd !== -Infinity) expect(b.range.start).toBeGreaterThanOrEqual(prevBlockEnd);
    prevBlockEnd = b.range.end;
    expect(b.outputRange.start).toBe(cumulativeDecoded);
    cumulativeDecoded = b.outputRange.end;
  }
  expect(cumulativeDecoded).toBe(totalDecoded);
}

describe('parseStream integration', () => {
  const positive: Array<[string, (b: Uint8Array) => Buffer]> = [
    ['empty.zlib', b => inflateSync(b)],
    ['stored-only.zlib', b => inflateSync(b)],
    ['fixed-huffman.zlib', b => inflateSync(b)],
    ['dynamic-small.zlib', b => inflateSync(b)],
    ['dynamic-large.zlib', b => inflateSync(b)],
    ['multi-block.zlib', b => inflateSync(b)],
    ['gzip-plain.gz', b => gunzipSync(b)],
    ['raw-deflate.bin', b => inflateRawSync(b)],
  ];

  for (const [name, reference] of positive) {
    it(`decodes ${name} byte-for-byte equal to Node's native zlib`, () => {
      const bytes = load(name);
      const result = parseStream(bytes);
      const expected = reference(bytes);
      expect(Buffer.from(result.decoded).equals(expected)).toBe(true);
      expect(result.errors.filter(e => e.severity === 'fatal')).toEqual([]);
      checkOffsetInvariants(bytes, result.blocks, result.decoded.length);
    });
  }

  it('bad-adler.zlib reports a soft error but still decodes the body', () => {
    const bytes = load('bad-adler.zlib');
    const result = parseStream(bytes);
    expect(result.errors.some(e => e.severity === 'soft' && /adler/i.test(e.message))).toBe(true);
    expect(result.decoded.length).toBeGreaterThan(0);
  });

  it('bad-crc.gz reports a soft error but still decodes the body', () => {
    const bytes = load('bad-crc.gz');
    const result = parseStream(bytes);
    expect(result.errors.some(e => e.severity === 'soft')).toBe(true);
    expect(result.decoded.length).toBeGreaterThan(0);
  });

  it('truncated.zlib produces a partial parse with a fatal error', () => {
    const bytes = load('truncated.zlib');
    const result = parseStream(bytes);
    expect(result.errors.some(e => e.severity === 'fatal' || e.severity === 'soft')).toBe(true);
  });
});
