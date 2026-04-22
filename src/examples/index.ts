export type Example = {
  id: string;
  label: string;
  description: string;
  path: string;
};

// All fixture paths are resolved against Vite's BASE_URL so that the app
// works both at / (dev) and at /zlib-viz/ (GitHub Pages deploy).
const b = import.meta.env.BASE_URL;

export const EXAMPLES: Example[] = [
  { id: 'stored', label: 'Stored (BTYPE=0)',
    description: 'zlib wrapper + stored-only blocks, no Huffman coding.',
    path: `${b}examples/stored-only.zlib` },
  { id: 'fixed', label: 'Fixed Huffman (BTYPE=1)',
    description: 'Uses the RFC 1951 fixed code tables, no dynamic meta.',
    path: `${b}examples/fixed-huffman.zlib` },
  { id: 'dynamic', label: 'Dynamic Huffman (BTYPE=2)',
    description: 'Full dynamic-Huffman meta: HLIT/HDIST/HCLEN + RLE code lengths.',
    path: `${b}examples/dynamic-small.zlib` },
  { id: 'gzip', label: 'gzip wrapper',
    description: 'RFC 1952 wrapper with CRC32 + ISIZE.',
    // Served as .bin so the static server does not set Content-Encoding: gzip,
    // which would make the browser transparently decompress the fixture.
    path: `${b}examples/gzip-plain.bin` },
  { id: 'raw', label: 'Raw DEFLATE',
    description: 'Headerless RFC 1951 stream.',
    path: `${b}examples/raw-deflate.bin` },
];
