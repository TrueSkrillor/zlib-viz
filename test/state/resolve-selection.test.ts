import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { parseStream } from '../../src/parser';
import { resolveSelection } from '../../src/state/resolve-selection';

describe('resolveSelection', () => {
  const parsed = parseStream(new Uint8Array(deflateSync(Buffer.from('abcabcabcabcabcabcabcabc'))));

  it('returns null ranges for kind:none', () => {
    const r = resolveSelection({ kind: 'none' }, parsed);
    expect(r.bitRange).toBeNull();
    expect(r.outputRange).toBeNull();
  });

  it('returns the block range for kind:block', () => {
    const r = resolveSelection({ kind: 'block', blockIndex: 0 }, parsed);
    expect(r.bitRange).toEqual(parsed.blocks[0].range);
    expect(r.outputRange).toEqual(parsed.blocks[0].outputRange);
  });

  it('returns a literal symbol range and 1-byte output for kind:symbol on a literal', () => {
    const body = parsed.blocks[0].body;
    if (body.kind !== 'huffman') throw new Error('expected huffman body');
    const idx = body.symbols.findIndex(s => s.kind === 'literal');
    const r = resolveSelection({ kind: 'symbol', blockIndex: 0, symbolIndex: idx }, parsed);
    expect(r.outputRange?.end).toBe((r.outputRange?.start ?? -1) + 1);
  });

  it('returns a match range, output slice, and backref slice for kind:symbol on a match', () => {
    const body = parsed.blocks[0].body;
    if (body.kind !== 'huffman') throw new Error('expected huffman body');
    const idx = body.symbols.findIndex(s => s.kind === 'match');
    if (idx < 0) return;
    const r = resolveSelection({ kind: 'symbol', blockIndex: 0, symbolIndex: idx }, parsed);
    expect(r.backrefRange).toBeDefined();
    expect((r.outputRange?.end ?? 0) - (r.outputRange?.start ?? 0)).toBeGreaterThan(0);
  });

  it('resolves a blockField pointing at a BitRange directly (HLIT/HDIST/HCLEN)', () => {
    // Build a dynamic-Huffman block to test. Needs enough varied text for Node to pick dynamic.
    const seed = Buffer.from(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.\n'.repeat(30),
    );
    const dyn = parseStream(new Uint8Array(deflateSync(seed)));
    const b = dyn.blocks.find(x => x.btype === 'dynamic');
    if (!b || b.body.kind !== 'huffman' || !b.body.dynamicMeta) {
      throw new Error('expected a dynamic Huffman block in fixture');
    }
    const r = resolveSelection(
      { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'hlitRange'] },
      dyn,
    );
    expect(r.bitRange).toEqual(b.body.dynamicMeta.hlitRange);
  });

  it('resolves a blockField pointing at an object with a .range property (wrapper.cmf-like)', () => {
    // Synthesize the shape in-line (our current tree doesn't emit this path, but the resolver
    // must still handle it — the spec's state model allows fieldPath into any object).
    const fakeParsed = {
      ...parsed,
      blocks: [{
        ...parsed.blocks[0],
        fakeField: { range: { start: 5, end: 11 }, value: 42 },
      }],
    };
    const r = resolveSelection(
      { kind: 'blockField', blockIndex: 0, fieldPath: ['fakeField'] },
      fakeParsed as unknown as typeof parsed,
    );
    expect(r.bitRange).toEqual({ start: 5, end: 11 });
  });
});
