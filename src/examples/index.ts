export type Example = {
  id: string;
  label: string;
  description: string;
  path: string;
};

export const EXAMPLES: Example[] = [
  { id: 'stored', label: 'Stored (BTYPE=0)',
    description: 'zlib wrapper + stored-only blocks, no Huffman coding.',
    path: '/examples/stored-only.zlib' },
  { id: 'fixed', label: 'Fixed Huffman (BTYPE=1)',
    description: 'Uses the RFC 1951 fixed code tables, no dynamic meta.',
    path: '/examples/fixed-huffman.zlib' },
  { id: 'dynamic', label: 'Dynamic Huffman (BTYPE=2)',
    description: 'Full dynamic-Huffman meta: HLIT/HDIST/HCLEN + RLE code lengths.',
    path: '/examples/dynamic-small.zlib' },
  { id: 'gzip', label: 'gzip wrapper',
    description: 'RFC 1952 wrapper with CRC32 + ISIZE.',
    path: '/examples/gzip-plain.gz' },
  { id: 'raw', label: 'Raw DEFLATE',
    description: 'Headerless RFC 1951 stream.',
    path: '/examples/raw-deflate.bin' },
];
