import type { ParsedStream } from '../parser/types';
import type { Selection } from './selection';

/**
 * Given a byte offset in `parsed.decoded`, find the innermost structural node that produced it.
 * Walks blocks → their symbols; prefers the symbol whose output slice contains the byte
 * (a match covers [outputStart, outputEnd); a literal covers [outputIndex, outputIndex + 1);
 * end-of-block has no output contribution). Falls back to the enclosing block if no symbol
 * matches (e.g. stored blocks), or `none` if the byte is outside every block's outputRange.
 */
export function findSelectionAtOutputByte(parsed: ParsedStream, byte: number): Selection {
  for (const b of parsed.blocks) {
    if (byte < b.outputRange.start || byte >= b.outputRange.end) continue;
    if (b.body.kind === 'huffman') {
      for (let i = 0; i < b.body.symbols.length; i++) {
        const s = b.body.symbols[i];
        if (s.kind === 'literal') {
          if (byte === s.outputIndex) return { kind: 'symbol', blockIndex: b.index, symbolIndex: i };
        } else if (s.kind === 'match') {
          if (byte >= s.outputStart && byte < s.outputEnd) return { kind: 'symbol', blockIndex: b.index, symbolIndex: i };
        }
      }
    }
    return { kind: 'block', blockIndex: b.index };
  }
  return { kind: 'none' };
}
