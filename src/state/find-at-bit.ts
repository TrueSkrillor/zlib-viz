import type { ParsedStream } from '../parser/types';
import type { Selection } from './selection';

export function findSelectionAtBit(parsed: ParsedStream, bit: number): Selection {
  for (const b of parsed.blocks) {
    if (bit < b.range.start || bit >= b.range.end) continue;
    if (b.body.kind === 'huffman') {
      for (let i = 0; i < b.body.symbols.length; i++) {
        const s = b.body.symbols[i];
        const start = s.kind === 'match' ? s.lengthCodeRange.start : s.bitRange.start;
        const end = s.kind === 'match' ? (s.distExtraRange ?? s.distCodeRange).end : s.bitRange.end;
        if (bit >= start && bit < end) return { kind: 'symbol', blockIndex: b.index, symbolIndex: i };
      }
    }
    return { kind: 'block', blockIndex: b.index };
  }
  if (parsed.trailer && bit >= parsed.trailer.range.start && bit < parsed.trailer.range.end) {
    return { kind: 'trailer' };
  }
  if (parsed.wrapper && bit >= parsed.wrapper.range.start && bit < parsed.wrapper.range.end) {
    return { kind: 'wrapper' };
  }
  return { kind: 'none' };
}
