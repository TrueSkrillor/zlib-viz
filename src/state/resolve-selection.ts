import type { ParsedStream, BitRange } from '../parser/types';
import type { Selection } from './selection';

export type ResolvedSelection = {
  bitRange: BitRange | null;
  outputRange: { start: number; end: number } | null;
  backrefRange?: { start: number; end: number };
};

export function resolveSelection(s: Selection, p: ParsedStream | null): ResolvedSelection {
  if (!p || s.kind === 'none') return { bitRange: null, outputRange: null };

  if (s.kind === 'wrapper') {
    return { bitRange: p.wrapper?.range ?? null, outputRange: null };
  }
  if (s.kind === 'trailer') {
    return { bitRange: p.trailer?.range ?? null, outputRange: null };
  }
  if (s.kind === 'block') {
    const b = p.blocks[s.blockIndex];
    return b ? { bitRange: b.range, outputRange: b.outputRange } : { bitRange: null, outputRange: null };
  }
  if (s.kind === 'blockField') {
    const b = p.blocks[s.blockIndex];
    if (!b) return { bitRange: null, outputRange: null };
    const field = lookupField(b, s.fieldPath);
    return { bitRange: asBitRange(field), outputRange: b.outputRange };
  }
  if (s.kind === 'blockSection') {
    const b = p.blocks[s.blockIndex];
    if (!b || b.body.kind !== 'huffman') return { bitRange: null, outputRange: null };
    const syms = b.body.symbols;
    const firstSymStart = syms.length > 0
      ? (syms[0].kind === 'match' ? syms[0].lengthCodeRange.start : syms[0].bitRange.start)
      : b.range.end;
    if (s.section === 'huffman-tables') {
      // Dynamic: the on-stream tables run from the start of the dynamic meta
      // through the last bit before the first symbol.
      // Fixed: tables are implicit (RFC 1951 §3.2.6), nothing is encoded in the stream.
      if (!b.body.dynamicMeta) return { bitRange: null, outputRange: null };
      return { bitRange: { start: b.body.dynamicMeta.hlitRange.start, end: firstSymStart }, outputRange: b.outputRange };
    }
    return { bitRange: { start: firstSymStart, end: b.range.end }, outputRange: b.outputRange };
  }
  if (s.kind === 'symbol') {
    const b = p.blocks[s.blockIndex];
    if (!b || b.body.kind !== 'huffman') return { bitRange: null, outputRange: null };
    const sym = b.body.symbols[s.symbolIndex];
    if (!sym) return { bitRange: null, outputRange: null };
    if (sym.kind === 'literal') {
      return {
        bitRange: sym.bitRange,
        outputRange: { start: sym.outputIndex, end: sym.outputIndex + 1 },
      };
    }
    if (sym.kind === 'match') {
      return {
        bitRange: { start: sym.lengthCodeRange.start, end: (sym.distExtraRange ?? sym.distCodeRange).end },
        outputRange: { start: sym.outputStart, end: sym.outputEnd },
        backrefRange: { start: sym.backrefStart, end: sym.backrefEnd },
      };
    }
    return { bitRange: sym.bitRange, outputRange: null };
  }
  return { bitRange: null, outputRange: null };
}

function lookupField(root: unknown, path: (string | number)[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

// A field path may terminate at a BitRange directly (e.g. `dynamicMeta.hlitRange`)
// or at a container object that has a `range: BitRange` property (e.g. wrapper.cmf).
function asBitRange(v: unknown): BitRange | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.start === 'number' && typeof o.end === 'number') return { start: o.start, end: o.end };
  const r = o.range;
  if (r && typeof r === 'object') {
    const rr = r as Record<string, unknown>;
    if (typeof rr.start === 'number' && typeof rr.end === 'number') return { start: rr.start, end: rr.end };
  }
  return null;
}
