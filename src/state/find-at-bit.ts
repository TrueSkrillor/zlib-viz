import type { BitRange, ParsedStream } from '../parser/types';
import type { Selection } from './selection';

const inRange = (bit: number, r: BitRange) => bit >= r.start && bit < r.end;

export function findSelectionAtBit(parsed: ParsedStream, bit: number): Selection {
  for (const b of parsed.blocks) {
    if (!inRange(bit, b.range)) continue;

    if (b.body.kind === 'huffman') {
      // Drill into the dynamic-Huffman meta region first, so a bit inside HLIT/HDIST/HCLEN
      // or a specific code-length entry picks the exact tree node rather than falling back
      // to the whole block.
      if (b.body.dynamicMeta) {
        const m = b.body.dynamicMeta;
        if (inRange(bit, m.hlitRange)) {
          return { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'hlitRange'] };
        }
        if (inRange(bit, m.hdistRange)) {
          return { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'hdistRange'] };
        }
        if (inRange(bit, m.hclenRange)) {
          return { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'hclenRange'] };
        }
        for (let i = 0; i < m.codeLenCodeLengths.length; i++) {
          if (inRange(bit, m.codeLenCodeLengths[i].range)) {
            return { kind: 'blockField', blockIndex: b.index, fieldPath: ['body', 'dynamicMeta', 'codeLenCodeLengths', i, 'range'] };
          }
        }
      }
      for (let i = 0; i < b.body.symbols.length; i++) {
        const s = b.body.symbols[i];
        const start = s.kind === 'match' ? s.lengthCodeRange.start : s.bitRange.start;
        const end = s.kind === 'match' ? (s.distExtraRange ?? s.distCodeRange).end : s.bitRange.end;
        if (bit >= start && bit < end) return { kind: 'symbol', blockIndex: b.index, symbolIndex: i };
      }
    }
    return { kind: 'block', blockIndex: b.index };
  }
  if (parsed.trailer && inRange(bit, parsed.trailer.range)) return { kind: 'trailer' };
  if (parsed.wrapper && inRange(bit, parsed.wrapper.range)) return { kind: 'wrapper' };
  return { kind: 'none' };
}
