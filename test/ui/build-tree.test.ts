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

  it('at depth 3 includes per-symbol rows under dynamic blocks', () => {
    const rows = buildTreeRows(parsed, 3);
    expect(rows.some(r => r.label.startsWith('lit ') || r.label.startsWith('match ') || r.label === 'end-of-block')).toBe(true);
    expect(rows.some(r => r.label.startsWith('HLIT='))).toBe(true);
  });
});
