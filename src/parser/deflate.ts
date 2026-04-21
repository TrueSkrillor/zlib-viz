import { BitReader } from './bit-reader';
import { buildHuffmanTable, decodeSymbol } from './huffman';
import {
  CODE_LEN_ORDER,
  DIST_BASE, DIST_EXTRA, FIXED_DIST_LENGTHS, FIXED_LITLEN_LENGTHS,
  LENGTH_BASE, LENGTH_EXTRA,
} from './constants';
import type { BitRange, Block, DynamicMeta, HuffmanBody, HuffmanTable, ParseError, RleEntry, StoredBody, Symbol as DeflateSymbol } from './types';

export type DeflateResult = {
  blocks: Block[];
  decoded: Uint8Array;
  errors: ParseError[];
};

const INITIAL_DECODED_CAP = 4096;

export function parseDeflate(r: BitReader, streamStartBit = 0): DeflateResult {
  const blocks: Block[] = [];
  const errors: ParseError[] = [];
  let decoded = new Uint8Array(INITIAL_DECODED_CAP);
  let decodedLen = 0;

  const ensureCapacity = (extra: number) => {
    if (decodedLen + extra <= decoded.length) return;
    let cap = decoded.length || INITIAL_DECODED_CAP;
    while (cap < decodedLen + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(decoded.subarray(0, decodedLen), 0);
    decoded = next;
  };

  const writeByte = (b: number) => {
    ensureCapacity(1);
    decoded[decodedLen++] = b;
  };

  const writeBytes = (src: Uint8Array) => {
    ensureCapacity(src.length);
    decoded.set(src, decodedLen);
    decodedLen += src.length;
  };

  const copyFromOutput = (distance: number, length: number): { srcStart: number; srcEnd: number } => {
    const srcStart = decodedLen - distance;
    if (srcStart < 0) throw new Error(`back-ref distance ${distance} exceeds output length ${decodedLen}`);
    ensureCapacity(length);
    for (let i = 0; i < length; i++) decoded[decodedLen + i] = decoded[srcStart + i];
    decodedLen += length;
    return { srcStart, srcEnd: srcStart + length };
  };

  try {
    while (true) {
      const blockStart = r.bitPos;
      const bfinal = r.readBits(1) === 1;
      const btype = r.readBits(2);
      const headerRange = { start: blockStart, end: r.bitPos };
      const outputStart = decodedLen;

      if (btype === 0b00) {
        const body = parseStoredBlock(r);
        writeBytes(body.bytes);
        blocks.push({
          index: blocks.length,
          bfinal, btype: 'stored',
          range: { start: blockStart, end: r.bitPos },
          headerRange,
          body,
          outputRange: { start: outputStart, end: decodedLen },
        });
      } else if (btype === 0b01) {
        const body = parseHuffmanBlock(r, 'fixed', writeByte, copyFromOutput, () => decodedLen);
        blocks.push({
          index: blocks.length,
          bfinal, btype: 'fixed',
          range: { start: blockStart, end: r.bitPos },
          headerRange,
          body,
          outputRange: { start: outputStart, end: decodedLen },
        });
      } else if (btype === 0b10) {
        const body = parseHuffmanBlock(r, 'dynamic', writeByte, copyFromOutput, () => decodedLen);
        blocks.push({
          index: blocks.length,
          bfinal, btype: 'dynamic',
          range: { start: blockStart, end: r.bitPos },
          headerRange,
          body,
          outputRange: { start: outputStart, end: decodedLen },
        });
      } else {
        throw new Error(`reserved btype (0b11) at bit ${blockStart}`);
      }

      if (bfinal) break;
    }
  } catch (err) {
    errors.push({
      severity: 'fatal',
      message: err instanceof Error ? err.message : String(err),
      bitPos: r.bitPos,
    });
  }

  void streamStartBit;

  return { blocks, decoded: decoded.subarray(0, decodedLen).slice(), errors };
}

function parseStoredBlock(r: BitReader): StoredBody {
  r.alignToByte();
  const lenStart = r.bitPos;
  const lenLo = r.readBits(8);
  const lenHi = r.readBits(8);
  const lenEnd = r.bitPos;
  const nlenLo = r.readBits(8);
  const nlenHi = r.readBits(8);
  const nlenEnd = r.bitPos;
  const len = lenLo | (lenHi << 8);
  const nlen = nlenLo | (nlenHi << 8);
  if ((len ^ 0xffff) !== nlen) throw new Error(`stored block: LEN=${len} / NLEN=${nlen} mismatch`);
  const payloadStart = r.bitPos;
  const bytes = r.readBytes(len);
  return {
    kind: 'stored',
    lenRange: { start: lenStart, end: lenEnd },
    nlenRange: { start: lenEnd, end: nlenEnd },
    payloadRange: { start: payloadStart, end: r.bitPos },
    bytes,
  };
}

function parseHuffmanBlock(
  r: BitReader,
  kind: 'fixed' | 'dynamic',
  writeByte: (b: number) => void,
  copyFromOutput: (distance: number, length: number) => { srcStart: number; srcEnd: number },
  outputLen: () => number,
): HuffmanBody {
  if (kind === 'fixed') {
    const litlenTable = buildHuffmanTable(FIXED_LITLEN_LENGTHS);
    const distTable = buildHuffmanTable(FIXED_DIST_LENGTHS);
    const symbols = decodeSymbols(r, litlenTable, distTable, writeByte, copyFromOutput, outputLen);
    return { kind: 'huffman', btype: 'fixed', litlenTable, distTable, symbols };
  }

  const hlitStart = r.bitPos;
  const hlit = r.readBits(5);
  const hlitRange = { start: hlitStart, end: r.bitPos };
  const hdistStart = r.bitPos;
  const hdist = r.readBits(5);
  const hdistRange = { start: hdistStart, end: r.bitPos };
  const hclenStart = r.bitPos;
  const hclen = r.readBits(4);
  const hclenRange = { start: hclenStart, end: r.bitPos };

  const clCount = hclen + 4;
  const clLengths = new Array<number>(19).fill(0);
  const codeLenCodeLengths: { value: number; range: BitRange }[] = [];
  for (let i = 0; i < clCount; i++) {
    const s = r.bitPos;
    const v = r.readBits(3);
    codeLenCodeLengths.push({ value: v, range: { start: s, end: r.bitPos } });
    clLengths[CODE_LEN_ORDER[i]] = v;
  }
  const codeLenTable = buildHuffmanTable(clLengths);

  const totalLengths = hlit + 257 + hdist + 1;
  const flatLengths = new Array<number>(totalLengths).fill(0);
  const litlenLengths: RleEntry[] = [];
  const distLengths: RleEntry[] = [];
  let i = 0;
  let lastLen = 0;
  while (i < totalLengths) {
    const codeStart = r.bitPos;
    const code = decodeSymbol(r, codeLenTable);
    const codeRange = { start: codeStart, end: r.bitPos };
    let extraRange: BitRange | undefined;
    let entry: RleEntry;

    if (code <= 15) {
      entry = {
        codeRange, kind: 'literal', value: code,
        expandedLengths: [code], expandedIndex: i,
      };
      flatLengths[i] = code;
      i++;
      lastLen = code;
    } else if (code === 16) {
      const s = r.bitPos;
      const extra = r.readBits(2);
      extraRange = { start: s, end: r.bitPos };
      const repeat = extra + 3;
      if (i === 0) throw new Error('RLE code 16 at start of code-length stream');
      const expanded = new Array<number>(repeat).fill(lastLen);
      entry = {
        codeRange, extraRange, kind: 'copy-prev',
        value: repeat, expandedLengths: expanded, expandedIndex: i,
      };
      for (let k = 0; k < repeat; k++) flatLengths[i + k] = lastLen;
      i += repeat;
    } else if (code === 17) {
      const s = r.bitPos;
      const extra = r.readBits(3);
      extraRange = { start: s, end: r.bitPos };
      const repeat = extra + 3;
      entry = {
        codeRange, extraRange, kind: 'zeros',
        value: repeat, expandedLengths: new Array<number>(repeat).fill(0), expandedIndex: i,
      };
      i += repeat;
      lastLen = 0;
    } else if (code === 18) {
      const s = r.bitPos;
      const extra = r.readBits(7);
      extraRange = { start: s, end: r.bitPos };
      const repeat = extra + 11;
      entry = {
        codeRange, extraRange, kind: 'zeros',
        value: repeat, expandedLengths: new Array<number>(repeat).fill(0), expandedIndex: i,
      };
      i += repeat;
      lastLen = 0;
    } else {
      throw new Error(`invalid code-length code ${code}`);
    }

    if (entry.expandedIndex < hlit + 257) litlenLengths.push(entry); else distLengths.push(entry);
  }
  if (i !== totalLengths) throw new Error('code-length RLE overran the alphabet');

  const litlenLenArray = flatLengths.slice(0, hlit + 257);
  const distLenArray = flatLengths.slice(hlit + 257);
  const litlenTable = buildHuffmanTable(litlenLenArray);
  const distTable = buildHuffmanTable(distLenArray);

  const dynamicMeta: DynamicMeta = {
    hlit, hdist, hclen,
    hlitRange, hdistRange, hclenRange,
    codeLenCodeLengths, codeLenTable,
    litlenLengths, distLengths,
  };

  const symbols = decodeSymbols(r, litlenTable, distTable, writeByte, copyFromOutput, outputLen);
  return { kind: 'huffman', btype: 'dynamic', litlenTable, distTable, dynamicMeta, symbols };
}

function decodeSymbols(
  r: BitReader,
  litlenTable: HuffmanTable,
  distTable: HuffmanTable,
  writeByte: (b: number) => void,
  copyFromOutput: (distance: number, length: number) => { srcStart: number; srcEnd: number },
  outputLen: () => number,
): DeflateSymbol[] {
  const symbols: DeflateSymbol[] = [];
  while (true) {
    const symStart = r.bitPos;
    const sym = decodeSymbol(r, litlenTable);
    if (sym < 256) {
      const outputIndex = outputLen();
      writeByte(sym);
      symbols.push({ kind: 'literal', value: sym, bitRange: { start: symStart, end: r.bitPos }, outputIndex });
      continue;
    }
    if (sym === 256) {
      symbols.push({ kind: 'end-of-block', bitRange: { start: symStart, end: r.bitPos } });
      return symbols;
    }
    const lengthCodeIdx = sym - 257;
    if (lengthCodeIdx < 0 || lengthCodeIdx >= LENGTH_BASE.length) throw new Error(`invalid length symbol ${sym}`);
    const lengthCodeRange = { start: symStart, end: r.bitPos };
    const extraLenBits = LENGTH_EXTRA[lengthCodeIdx];
    let lengthExtraRange: { start: number; end: number } | undefined;
    let length = LENGTH_BASE[lengthCodeIdx];
    if (extraLenBits > 0) {
      const s = r.bitPos;
      length += r.readBits(extraLenBits);
      lengthExtraRange = { start: s, end: r.bitPos };
    }
    const distCodeStart = r.bitPos;
    const distSym = decodeSymbol(r, distTable);
    const distCodeRange = { start: distCodeStart, end: r.bitPos };
    if (distSym < 0 || distSym >= DIST_BASE.length) throw new Error(`invalid distance symbol ${distSym}`);
    const extraDistBits = DIST_EXTRA[distSym];
    let distExtraRange: { start: number; end: number } | undefined;
    let distance = DIST_BASE[distSym];
    if (extraDistBits > 0) {
      const s = r.bitPos;
      distance += r.readBits(extraDistBits);
      distExtraRange = { start: s, end: r.bitPos };
    }
    const outputStart = outputLen();
    const { srcStart, srcEnd } = copyFromOutput(distance, length);
    symbols.push({
      kind: 'match',
      length, distance,
      lengthCodeRange, lengthExtraRange, distCodeRange, distExtraRange,
      outputStart, outputEnd: outputStart + length,
      backrefStart: srcStart, backrefEnd: srcEnd,
    });
  }
}
