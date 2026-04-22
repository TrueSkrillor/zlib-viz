import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { parseStream } from '../../src/parser';
import { buildTreeRows } from '../../src/ui/structure-pane/build-tree';

const longInput = Buffer.from(
  'the quick brown fox jumps over the lazy dog '.repeat(30) +
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(30),
);
const parsed = parseStream(new Uint8Array(deflateSync(longInput, { level: 9 })));

describe('buildTreeRows', () => {
  it('default expansion shows only wrapper + blocks + trailer (every block collapsed)', () => {
    const rows = buildTreeRows(parsed);
    expect(rows.map(r => r.label)).toContain('zlib wrapper');
    expect(rows.filter(r => r.label.startsWith('Block')).length).toBe(parsed.blocks.length);
    expect(rows.some(r => /ADLER32/.test(r.label))).toBe(true);
    expect(rows.some(r => r.label.startsWith('block header'))).toBe(false);
    expect(rows.some(r => r.label.startsWith('HLIT='))).toBe(false);
    expect(rows.some(r => r.label.startsWith('Huffman tables'))).toBe(false);
    expect(rows.some(r => r.label.startsWith('symbols ('))).toBe(false);
  });

  it('expanding a block reveals its header, dynamic-meta fields, Huffman tables, and symbols group', () => {
    const rows = buildTreeRows(parsed, { 'block:0': true });
    expect(rows.some(r => r.label.startsWith('block header'))).toBe(true);
    expect(rows.some(r => r.label.startsWith('HLIT='))).toBe(true);
    expect(rows.some(r => r.label.startsWith('Huffman tables'))).toBe(true);
    expect(rows.some(r => r.label.startsWith('symbols ('))).toBe(true);
    // symbols group itself collapsed: no per-symbol rows yet
    expect(rows.some(r => r.label.startsWith('lit ') || r.label.startsWith('match '))).toBe(false);
  });

  it('expanding block + symbols reveals per-symbol rows', () => {
    const rows = buildTreeRows(parsed, { 'block:0': true, 'symbols:0': true });
    expect(rows.some(r => r.label.startsWith('lit ') || r.label.startsWith('match ') || r.label === 'end-of-block')).toBe(true);
  });

  it('block-header row precedes the symbols row within an expanded block', () => {
    const rows = buildTreeRows(parsed, { 'block:0': true });
    const headerIdx = rows.findIndex(r => r.label.startsWith('block header'));
    const symbolsIdx = rows.findIndex(r => r.label.startsWith('symbols ('));
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(symbolsIdx).toBeGreaterThan(headerIdx);
  });
});
