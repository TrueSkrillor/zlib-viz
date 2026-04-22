import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { parseStream } from '../../src/parser';
import { buildTreeRows } from '../../src/ui/structure-pane/build-tree';

// Use a payload long enough to force dynamic Huffman blocks
const longInput = Buffer.from(
  'the quick brown fox jumps over the lazy dog '.repeat(30) +
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(30),
);
const parsed = parseStream(new Uint8Array(deflateSync(longInput, { level: 9 })));

describe('buildTreeRows', () => {
  it('at depth 1 includes wrapper + blocks + trailer only', () => {
    const rows = buildTreeRows(parsed, 1);
    expect(rows.map(r => r.label)).toContain('zlib wrapper');
    expect(rows.filter(r => r.label.startsWith('Block')).length).toBe(parsed.blocks.length);
    expect(rows.some(r => /ADLER32/.test(r.label))).toBe(true);
    expect(rows.some(r => r.label.startsWith('lit ') || r.label.startsWith('match '))).toBe(false);
  });

  it('at depth 3, blocks are expanded by default; HLIT row is visible', () => {
    const rows = buildTreeRows(parsed, 3);
    expect(rows.some(r => r.label.startsWith('HLIT='))).toBe(true);
    expect(rows.some(r => r.label.startsWith('Huffman tables'))).toBe(true);
    expect(rows.some(r => r.label.startsWith('symbols ('))).toBe(true);
  });

  it('symbols group collapses by default; per-symbol rows appear only after expand', () => {
    const collapsed = buildTreeRows(parsed, 3);
    expect(collapsed.some(r => r.label.startsWith('lit ') || r.label.startsWith('match '))).toBe(false);

    // Find a symbols id to expand
    const symRow = collapsed.find(r => r.id?.startsWith('symbols:'));
    expect(symRow).toBeDefined();
    const expanded = buildTreeRows(parsed, 3, { [symRow!.id!]: true });
    expect(expanded.some(r => r.label.startsWith('lit ') || r.label.startsWith('match ') || r.label === 'end-of-block')).toBe(true);
  });

  it('collapsing a block hides all its children', () => {
    const expansion = { 'block:0': false };
    const rows = buildTreeRows(parsed, 3, expansion);
    // Block 0 itself is still present
    expect(rows.some(r => r.label.startsWith('Block 0'))).toBe(true);
    // But no HLIT / Huffman tables / symbols rows attributable to block 0
    // (Later blocks might still contribute, so filter to block 0's section)
    const block0Idx = rows.findIndex(r => r.label.startsWith('Block 0'));
    const nextBlockIdx = rows.findIndex((r, i) => i > block0Idx && r.label.startsWith('Block '));
    const block0Children = rows.slice(block0Idx + 1, nextBlockIdx === -1 ? undefined : nextBlockIdx);
    expect(block0Children.some(r => r.label.startsWith('HLIT='))).toBe(false);
    expect(block0Children.some(r => r.label.startsWith('Huffman tables'))).toBe(false);
  });
});
