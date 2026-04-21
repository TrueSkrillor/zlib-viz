import { deflateRawSync, deflateSync, gzipSync } from 'node:zlib';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseStream } from '../../src/parser';
import type { Block } from '../../src/parser/types';

const bytesArb = fc.uint8Array({ minLength: 0, maxLength: 8 * 1024 });

function assertBlocksCover(bytes: Uint8Array, blocks: Block[], decodedLen: number) {
  let cumulative = 0;
  for (const b of blocks) {
    expect(b.outputRange.start).toBe(cumulative);
    cumulative = b.outputRange.end;
    expect(b.range.end).toBeLessThanOrEqual(bytes.length * 8);
  }
  expect(cumulative).toBe(decodedLen);
}

describe('parseStream property tests', () => {
  it('zlib: decoded output equals input', () => {
    fc.assert(
      fc.property(bytesArb, (input) => {
        const compressed = new Uint8Array(deflateSync(Buffer.from(input)));
        const result = parseStream(compressed);
        expect(result.errors.filter(e => e.severity === 'fatal')).toEqual([]);
        expect(Buffer.from(result.decoded).equals(Buffer.from(input))).toBe(true);
        assertBlocksCover(compressed, result.blocks, result.decoded.length);
      }),
      { numRuns: 120 },
    );
  });

  it('gzip: decoded output equals input', () => {
    fc.assert(
      fc.property(bytesArb, (input) => {
        const compressed = new Uint8Array(gzipSync(Buffer.from(input)));
        const result = parseStream(compressed);
        expect(result.errors.filter(e => e.severity === 'fatal')).toEqual([]);
        expect(Buffer.from(result.decoded).equals(Buffer.from(input))).toBe(true);
      }),
      { numRuns: 80 },
    );
  });

  it('raw-deflate: decoded output equals input', () => {
    fc.assert(
      fc.property(bytesArb, (input) => {
        const compressed = new Uint8Array(deflateRawSync(Buffer.from(input)));
        const result = parseStream(compressed);
        expect(Buffer.from(result.decoded).equals(Buffer.from(input))).toBe(true);
      }),
      { numRuns: 80 },
    );
  });
});
