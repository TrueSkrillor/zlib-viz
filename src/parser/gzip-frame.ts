import { BitReader } from './bit-reader';
import { parseDeflate } from './deflate';
import type { Block, GzipTrailer, GzipWrapper, ParseError } from './types';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function parseGzip(r: BitReader): {
  wrapper: GzipWrapper;
  blocks: Block[];
  decoded: Uint8Array;
  trailer: GzipTrailer | undefined;
  errors: ParseError[];
} {
  const errors: ParseError[] = [];
  const start = r.bitPos;
  const id1 = r.readBits(8), id2 = r.readBits(8);
  if (id1 !== 0x1f || id2 !== 0x8b) throw new Error('not a gzip stream');
  const cm = r.readBits(8);
  const flgStart = r.bitPos;
  const flg = r.readBits(8);
  const flagsRange = { start: flgStart, end: r.bitPos };
  const mtimeStart = r.bitPos;
  const m0 = r.readBits(8), m1 = r.readBits(8), m2 = r.readBits(8), m3 = r.readBits(8);
  const mtime = (m0 | (m1 << 8) | (m2 << 16) | (m3 << 24)) >>> 0;
  const mtimeRange = { start: mtimeStart, end: r.bitPos };
  const xfl = r.readBits(8);
  const os = r.readBits(8);

  const wrapper: GzipWrapper = {
    kind: 'gzip',
    range: { start, end: r.bitPos },
    id1, id2, cm, flg, mtime, xfl, os,
    flagsRange, mtimeRange,
  };

  if (flg & 0x04) {
    const xs = r.bitPos;
    const xlenLo = r.readBits(8), xlenHi = r.readBits(8);
    const xlen = xlenLo | (xlenHi << 8);
    const bytes = r.readBytes(xlen);
    wrapper.fextra = { range: { start: xs, end: r.bitPos }, bytes };
  }
  if (flg & 0x08) {
    const xs = r.bitPos;
    const value = readNullTerminatedString(r);
    wrapper.fname = { range: { start: xs, end: r.bitPos }, value };
  }
  if (flg & 0x10) {
    const xs = r.bitPos;
    const value = readNullTerminatedString(r);
    wrapper.fcomment = { range: { start: xs, end: r.bitPos }, value };
  }
  if (flg & 0x02) {
    const xs = r.bitPos;
    const lo = r.readBits(8), hi = r.readBits(8);
    wrapper.headerCrc = { range: { start: xs, end: r.bitPos }, value: lo | (hi << 8) };
  }

  const deflateResult = parseDeflate(r);
  errors.push(...deflateResult.errors);
  const blocks = deflateResult.blocks;
  const decoded = deflateResult.decoded;

  let trailer: GzipTrailer | undefined;
  try {
    r.alignToByte();
    const crcStart = r.bitPos;
    const c0 = r.readBits(8), c1 = r.readBits(8), c2 = r.readBits(8), c3 = r.readBits(8);
    const crcStored = (c0 | (c1 << 8) | (c2 << 16) | (c3 << 24)) >>> 0;
    const crcEnd = r.bitPos;
    const sizStart = r.bitPos;
    const s0 = r.readBits(8), s1 = r.readBits(8), s2 = r.readBits(8), s3 = r.readBits(8);
    const isizeStored = (s0 | (s1 << 8) | (s2 << 16) | (s3 << 24)) >>> 0;
    const sizEnd = r.bitPos;

    const crcComputed = crc32(decoded);
    const isizeComputed = decoded.length >>> 0;

    trailer = {
      kind: 'gzip-trailer',
      range: { start: crcStart, end: sizEnd },
      crc32: { value: crcStored, computed: crcComputed, valid: crcStored === crcComputed, range: { start: crcStart, end: crcEnd } },
      isize: { value: isizeStored, computed: isizeComputed, valid: isizeStored === isizeComputed, range: { start: sizStart, end: sizEnd } },
    };
    if (!trailer.crc32.valid) errors.push({ severity: 'soft', message: 'gzip CRC32 mismatch', bitRange: trailer.crc32.range });
    if (!trailer.isize.valid) errors.push({ severity: 'soft', message: 'gzip ISIZE mismatch', bitRange: trailer.isize.range });
  } catch (err) {
    errors.push({
      severity: 'soft',
      message: `truncated gzip trailer: ${err instanceof Error ? err.message : err}`,
      bitPos: r.bitPos,
    });
  }

  wrapper.range = { start, end: trailer ? trailer.range.end : r.bitPos };

  return { wrapper, blocks, decoded, trailer, errors };
}

function readNullTerminatedString(r: BitReader): string {
  const bytes: number[] = [];
  while (true) {
    const b = r.readBits(8);
    if (b === 0) break;
    bytes.push(b);
  }
  return new TextDecoder('latin1').decode(new Uint8Array(bytes));
}
