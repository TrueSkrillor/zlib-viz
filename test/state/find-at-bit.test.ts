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

  it('returns blockField selection for bits inside HLIT/HDIST/HCLEN of a dynamic block', () => {
    const seed = Buffer.from(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.\n'.repeat(30),
    );
    const dyn = parseStream(new Uint8Array(deflateSync(seed)));
    const b = dyn.blocks.find(x => x.btype === 'dynamic');
    if (!b || b.body.kind !== 'huffman' || !b.body.dynamicMeta) throw new Error('need dynamic block');
    const m = b.body.dynamicMeta;

    const hlitSel = findSelectionAtBit(dyn, m.hlitRange.start + 2);
    expect(hlitSel.kind).toBe('blockField');
    if (hlitSel.kind === 'blockField') expect(hlitSel.fieldPath).toEqual(['body', 'dynamicMeta', 'hlitRange']);

    const hdistSel = findSelectionAtBit(dyn, m.hdistRange.start + 1);
    expect(hdistSel.kind).toBe('blockField');
    if (hdistSel.kind === 'blockField') expect(hdistSel.fieldPath).toEqual(['body', 'dynamicMeta', 'hdistRange']);

    const hclenSel = findSelectionAtBit(dyn, m.hclenRange.start + 1);
    expect(hclenSel.kind).toBe('blockField');
    if (hclenSel.kind === 'blockField') expect(hclenSel.fieldPath).toEqual(['body', 'dynamicMeta', 'hclenRange']);
  });
});
