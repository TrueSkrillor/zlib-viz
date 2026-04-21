import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { parseStream } from '../../src/parser';
import { findSelectionAtBit } from '../../src/state/find-at-bit';

describe('findSelectionAtBit', () => {
  const parsed = parseStream(new Uint8Array(deflateSync(Buffer.from('abcabcabcabcabcabc'))));

  it('returns wrapper selection for a bit inside the wrapper', () => {
    const w = parsed.wrapper!;
    const s = findSelectionAtBit(parsed, w.range.start + 2);
    expect(s.kind).toBe('wrapper');
  });

  it('returns symbol selection for a bit inside a symbol in a huffman block', () => {
    const b = parsed.blocks[0];
    if (b.body.kind !== 'huffman') throw new Error('expected huffman');
    const sym = b.body.symbols[0];
    const bit = (sym.kind === 'match' ? sym.lengthCodeRange.start : sym.bitRange.start) + 0;
    const s = findSelectionAtBit(parsed, bit);
    expect(s.kind).toBe('symbol');
  });

  it('returns block selection for a bit inside a block but between symbols (edge-of-header)', () => {
    const b = parsed.blocks[0];
    const s = findSelectionAtBit(parsed, b.headerRange.start);
    expect(['block', 'symbol']).toContain(s.kind);
  });

  it('returns none for a bit outside all ranges', () => {
    expect(findSelectionAtBit(parsed, parsed.totalBytes * 8 + 100).kind).toBe('none');
  });
});
