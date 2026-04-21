import type { ParsedStream } from './types';

export function detectFormat(bytes: Uint8Array): ParsedStream['format'] {
  if (bytes.length < 2) return 'raw-deflate';
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  const cm = bytes[0] & 0x0f;
  const headerWord = (bytes[0] << 8) | bytes[1];
  if (cm === 8 && headerWord % 31 === 0) return 'zlib';
  return 'raw-deflate';
}
