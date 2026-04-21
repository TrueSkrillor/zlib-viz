import type { BitReader } from './bit-reader';
import type { HuffmanTable } from './types';

const MAX_BITS_CAP = 15;

export function buildHuffmanTable(lengths: number[]): HuffmanTable {
  const blCount = new Array<number>(MAX_BITS_CAP + 1).fill(0);
  for (const len of lengths) {
    if (len < 0 || len > MAX_BITS_CAP) throw new Error(`invalid code length ${len}`);
    blCount[len]++;
  }
  blCount[0] = 0;

  let code = 0;
  const nextCode = new Array<number>(MAX_BITS_CAP + 1).fill(0);
  for (let bits = 1; bits <= MAX_BITS_CAP; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  let maxBits = 0;
  for (let i = MAX_BITS_CAP; i >= 1; i--) {
    if (blCount[i] > 0) { maxBits = i; break; }
  }
  if (maxBits === 0) {
    return { lengths: lengths.slice(), lookup: new Uint16Array(0), maxBits: 0, symbolsByCode: [] };
  }

  // Kraft inequality check: sum of 2^-len ≤ 1, with equality required for a complete code.
  // We allow single-symbol alphabets (one code of length 1) as DEFLATE permits degenerate trees.
  let totalSymbols = 0;
  for (let bits = 1; bits <= MAX_BITS_CAP; bits++) totalSymbols += blCount[bits];
  if (totalSymbols > 1) {
    let kraftNum = 0;
    const denom = 1 << maxBits;
    for (let bits = 1; bits <= maxBits; bits++) kraftNum += blCount[bits] << (maxBits - bits);
    if (kraftNum > denom) throw new Error('Huffman code over-subscribed (Kraft inequality violated)');
  }

  const symbolsByCode: HuffmanTable['symbolsByCode'] = [];
  for (let sym = 0; sym < lengths.length; sym++) {
    const len = lengths[sym];
    if (len === 0) continue;
    const c = nextCode[len]++;
    symbolsByCode.push({ symbol: sym, bits: len, code: c });
  }
  symbolsByCode.sort((a, b) => (a.bits - b.bits) || (a.code - b.code));

  // Build a flat lookup table of size 2^maxBits, indexed by the LSB-first reversed code.
  const lookupSize = 1 << maxBits;
  const lookup = new Uint16Array(lookupSize);
  // Encoding: lookup[i] = (symbol << 4) | bits.  bits == 0 means "invalid".
  for (const { symbol, bits, code } of symbolsByCode) {
    const reversed = reverseBits(code, bits);
    const step = 1 << bits;
    for (let i = reversed; i < lookupSize; i += step) {
      lookup[i] = (symbol << 4) | bits;
    }
  }

  return { lengths: lengths.slice(), lookup, maxBits, symbolsByCode };
}

export function decodeSymbol(r: BitReader, t: HuffmanTable): number {
  if (t.maxBits === 0) throw new Error('decodeSymbol: empty Huffman table');
  const idx = r.peek(t.maxBits);
  const entry = t.lookup[idx];
  const bits = entry & 0xf;
  if (bits === 0) throw new Error('decodeSymbol: no matching code');
  r.advance(bits);
  return entry >> 4;
}

function reverseBits(value: number, bits: number): number {
  let r = 0;
  for (let i = 0; i < bits; i++) r = (r << 1) | ((value >> i) & 1);
  return r;
}
