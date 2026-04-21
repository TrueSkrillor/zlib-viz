// RFC 1951 §3.2.5 — length codes 257..285
// lengthBase[code - 257] = base length; lengthExtra[code - 257] = extra bits.
export const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
] as const;

export const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
] as const;

// RFC 1951 §3.2.5 — distance codes 0..29
export const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
] as const;

export const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
] as const;

// RFC 1951 §3.2.7 — permutation order for the HCLEN+4 code-length code lengths.
export const CODE_LEN_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
] as const;

// RFC 1951 §3.2.6 — fixed Huffman code lengths for the lit/len alphabet (288 symbols).
export const FIXED_LITLEN_LENGTHS: number[] = (() => {
  const a = new Array<number>(288);
  for (let i = 0; i <= 143; i++) a[i] = 8;
  for (let i = 144; i <= 255; i++) a[i] = 9;
  for (let i = 256; i <= 279; i++) a[i] = 7;
  for (let i = 280; i <= 287; i++) a[i] = 8;
  return a;
})();

// RFC 1951 §3.2.6 — fixed distance alphabet, 30 symbols each with length 5.
export const FIXED_DIST_LENGTHS: number[] = new Array(30).fill(5);
