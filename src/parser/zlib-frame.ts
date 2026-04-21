import { BitReader } from './bit-reader';
import { parseDeflate } from './deflate';
import type { Adler32Trailer, Block, ParseError, ZlibWrapper } from './types';

export function parseZlib(r: BitReader): {
  wrapper: ZlibWrapper;
  blocks: Block[];
  decoded: Uint8Array;
  trailer: Adler32Trailer | undefined;
  errors: ParseError[];
} {
  const errors: ParseError[] = [];
  const wrapperStart = r.bitPos;
  const cmfStart = r.bitPos;
  const cmfValue = r.readBits(8);
  const cmfRange = { start: cmfStart, end: r.bitPos };
  const flgStart = r.bitPos;
  const flgValue = r.readBits(8);
  const flgRange = { start: flgStart, end: r.bitPos };

  const cm = cmfValue & 0x0f;
  const cinfo = (cmfValue >> 4) & 0x0f;
  const fcheck = flgValue & 0x1f;
  const fdict = ((flgValue >> 5) & 1) === 1;
  const flevel = (flgValue >> 6) & 0x03;

  const wrapper: ZlibWrapper = {
    kind: 'zlib',
    range: { start: wrapperStart, end: r.bitPos },
    cmf: { value: cmfValue, range: cmfRange, cm, cinfo },
    flg: { value: flgValue, range: flgRange, fcheck, fdict, flevel },
  };

  if (fdict) {
    const s = r.bitPos;
    const b0 = r.readBits(8), b1 = r.readBits(8), b2 = r.readBits(8), b3 = r.readBits(8);
    wrapper.dictId = {
      value: ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0,
      range: { start: s, end: r.bitPos },
    };
  }

  wrapper.range = { start: wrapperStart, end: r.bitPos };

  const deflateResult = parseDeflate(r);
  errors.push(...deflateResult.errors);
  const blocks = deflateResult.blocks;
  const decoded = deflateResult.decoded;

  let trailer: Adler32Trailer | undefined;
  try {
    r.alignToByte();
    const trailerStart = r.bitPos;
    const b0 = r.readBits(8), b1 = r.readBits(8), b2 = r.readBits(8), b3 = r.readBits(8);
    const stored = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    const computed = adler32(decoded);
    const valid = stored === computed;
    trailer = {
      kind: 'adler32',
      range: { start: trailerStart, end: r.bitPos },
      value: stored, computed, valid,
    };
    if (!valid) errors.push({ severity: 'soft', message: 'ADLER32 mismatch', bitRange: trailer.range });
  } catch (err) {
    errors.push({
      severity: 'soft',
      message: `truncated ADLER32: ${err instanceof Error ? err.message : err}`,
      bitPos: r.bitPos,
    });
  }

  return { wrapper, blocks, decoded, trailer, errors };
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  const MOD = 65521;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}
