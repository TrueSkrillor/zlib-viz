import { describe, expect, it } from 'vitest';
import { detectFormat } from '../../src/parser/format-detect';

describe('detectFormat', () => {
  it('detects gzip from magic bytes', () => {
    expect(detectFormat(new Uint8Array([0x1f, 0x8b, 0x08, 0x00]))).toBe('gzip');
  });

  it('detects zlib when CMF.CM=8 and (CMF*256+FLG) % 31 == 0', () => {
    expect(detectFormat(new Uint8Array([0x78, 0x9c]))).toBe('zlib');
  });

  it('falls back to raw-deflate for non-matching headers', () => {
    expect(detectFormat(new Uint8Array([0x00, 0x00]))).toBe('raw-deflate');
    expect(detectFormat(new Uint8Array([0xff, 0xff]))).toBe('raw-deflate');
  });

  it('returns raw-deflate for inputs shorter than 2 bytes', () => {
    expect(detectFormat(new Uint8Array([]))).toBe('raw-deflate');
    expect(detectFormat(new Uint8Array([0x78]))).toBe('raw-deflate');
  });

  it('rejects zlib when CM is not deflate', () => {
    const cmf = 0x77;
    let flg = 0;
    for (let f = 0; f < 256; f++) if (((cmf * 256 + f) % 31) === 0) { flg = f; break; }
    expect(detectFormat(new Uint8Array([cmf, flg]))).toBe('raw-deflate');
  });
});
