import type { ParsedStream } from '../../parser/types';
import type { Depth, Selection } from '../../state/selection';

export type TreeRow = {
  depth: number;
  label: string;
  detail?: string;
  rangeText?: string;
  selection: Selection;
  expandable: boolean;
};

export function buildTreeRows(parsed: ParsedStream, depth: Depth): TreeRow[] {
  const rows: TreeRow[] = [];
  if (parsed.wrapper) {
    rows.push({
      depth: 0,
      label: `${parsed.wrapper.kind} wrapper`,
      rangeText: rangeText(parsed.wrapper.range),
      selection: { kind: 'wrapper' },
      expandable: false,
    });
  }
  for (const b of parsed.blocks) {
    rows.push({
      depth: 0,
      label: `Block ${b.index} · ${b.btype}${b.bfinal ? ' (final)' : ''}`,
      detail: `${(b.range.end - b.range.start) >> 3} bytes`,
      rangeText: rangeText(b.range),
      selection: { kind: 'block', blockIndex: b.index },
      expandable: depth >= 2,
    });
    if (depth >= 2 && b.body.kind === 'huffman' && b.body.dynamicMeta) {
      const m = b.body.dynamicMeta;
      if (depth >= 3) {
        rows.push({ depth: 1, label: `HLIT=${m.hlit}`, rangeText: rangeText(m.hlitRange),
          selection: { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'hlitRange'] }, expandable: false });
        rows.push({ depth: 1, label: `HDIST=${m.hdist}`, rangeText: rangeText(m.hdistRange),
          selection: { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'hdistRange'] }, expandable: false });
        rows.push({ depth: 1, label: `HCLEN=${m.hclen}`, rangeText: rangeText(m.hclenRange),
          selection: { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'hclenRange'] }, expandable: false });
      }
      rows.push({ depth: 1, label: 'Huffman tables', detail: `litlen ${b.body.litlenTable.symbolsByCode.length} · dist ${b.body.distTable.symbolsByCode.length}`, selection: { kind: 'block', blockIndex: b.index }, expandable: false });
    }
    if (depth >= 2 && b.body.kind === 'huffman') {
      rows.push({ depth: 1, label: `symbols (${b.body.symbols.length})`, selection: { kind: 'block', blockIndex: b.index }, expandable: depth >= 3 });
      if (depth >= 3) {
        for (let i = 0; i < b.body.symbols.length; i++) {
          const s = b.body.symbols[i];
          const label = s.kind === 'literal' ? `lit ${s.value} ${printable(s.value)}`
            : s.kind === 'match' ? `match len=${s.length} dist=${s.distance}`
            : 'end-of-block';
          const rng = s.kind === 'match' ? { start: s.lengthCodeRange.start, end: (s.distExtraRange ?? s.distCodeRange).end }
            : s.kind === 'literal' ? s.bitRange : s.bitRange;
          rows.push({ depth: 2, label, rangeText: rangeText(rng), selection: { kind: 'symbol', blockIndex: b.index, symbolIndex: i }, expandable: false });
        }
      }
    }
  }
  if (parsed.trailer) {
    rows.push({
      depth: 0,
      label: parsed.trailer.kind === 'adler32' ? `ADLER32 = 0x${parsed.trailer.value.toString(16).padStart(8,'0')} ${parsed.trailer.valid ? '✓' : '✗'}`
        : `CRC32 + ISIZE ${parsed.trailer.crc32.valid && parsed.trailer.isize.valid ? '✓' : '✗'}`,
      rangeText: rangeText(parsed.trailer.range),
      selection: { kind: 'trailer' },
      expandable: false,
    });
  }
  return rows;
}

function rangeText(r: { start: number; end: number }): string {
  return `bits ${r.start.toLocaleString()}–${r.end.toLocaleString()}`;
}
function printable(c: number): string {
  return c >= 0x20 && c < 0x7f ? `'${String.fromCharCode(c)}'` : '';
}
