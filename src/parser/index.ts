import { BitReader } from './bit-reader';
import { parseDeflate } from './deflate';
import { detectFormat } from './format-detect';
import { parseGzip } from './gzip-frame';
import { parseZlib } from './zlib-frame';
import type { ParsedStream } from './types';

export * from './types';
export { detectFormat };

export function parseStream(bytes: Uint8Array): ParsedStream {
  const format = detectFormat(bytes);
  const r = new BitReader(bytes);

  if (format === 'zlib') {
    const { wrapper, blocks, decoded, trailer, errors } = parseZlib(r);
    return { format, totalBytes: bytes.length, wrapper, blocks, trailer, decoded, errors };
  }
  if (format === 'gzip') {
    const { wrapper, blocks, decoded, trailer, errors } = parseGzip(r);
    return { format, totalBytes: bytes.length, wrapper, blocks, trailer, decoded, errors };
  }
  const { blocks, decoded, errors } = parseDeflate(r);
  return { format: 'raw-deflate', totalBytes: bytes.length, blocks, decoded, errors };
}
