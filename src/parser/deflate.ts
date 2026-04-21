import { BitReader } from './bit-reader';
import type { Block, ParseError, StoredBody } from './types';

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
      } else if (btype === 0b01 || btype === 0b10) {
        throw new Error(`btype ${btype} not supported yet`);
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
  void writeByte;

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
