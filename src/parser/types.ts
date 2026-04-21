export type BitRange = { start: number; end: number };

export type ParsedStream = {
  format: 'zlib' | 'gzip' | 'raw-deflate';
  totalBytes: number;
  wrapper?: ZlibWrapper | GzipWrapper;
  blocks: Block[];
  trailer?: Adler32Trailer | GzipTrailer;
  decoded: Uint8Array;
  errors: ParseError[];
};

export type ZlibWrapper = {
  kind: 'zlib';
  range: BitRange;
  cmf: { value: number; range: BitRange; cm: number; cinfo: number };
  flg: { value: number; range: BitRange; fcheck: number; fdict: boolean; flevel: number };
  dictId?: { value: number; range: BitRange };
};

export type GzipWrapper = {
  kind: 'gzip';
  range: BitRange;
  id1: number; id2: number;
  cm: number; flg: number; mtime: number; xfl: number; os: number;
  flagsRange: BitRange;
  mtimeRange: BitRange;
  fextra?: { range: BitRange; bytes: Uint8Array };
  fname?: { range: BitRange; value: string };
  fcomment?: { range: BitRange; value: string };
  headerCrc?: { range: BitRange; value: number };
};

export type Adler32Trailer = {
  kind: 'adler32';
  range: BitRange;
  value: number;
  computed: number;
  valid: boolean;
};

export type GzipTrailer = {
  kind: 'gzip-trailer';
  range: BitRange;
  crc32: { value: number; computed: number; valid: boolean; range: BitRange };
  isize: { value: number; computed: number; valid: boolean; range: BitRange };
};

export type Block = {
  index: number;
  bfinal: boolean;
  btype: 'stored' | 'fixed' | 'dynamic';
  range: BitRange;
  headerRange: BitRange;
  body: StoredBody | HuffmanBody;
  outputRange: { start: number; end: number };
};

export type StoredBody = {
  kind: 'stored';
  lenRange: BitRange;
  nlenRange: BitRange;
  payloadRange: BitRange;
  bytes: Uint8Array;
};

export type HuffmanBody = {
  kind: 'huffman';
  btype: 'fixed' | 'dynamic';
  litlenTable: HuffmanTable;
  distTable: HuffmanTable;
  dynamicMeta?: DynamicMeta;
  symbols: Symbol[];
};

export type DynamicMeta = {
  hlit: number; hdist: number; hclen: number;
  hlitRange: BitRange; hdistRange: BitRange; hclenRange: BitRange;
  codeLenCodeLengths: { value: number; range: BitRange }[];
  codeLenTable: HuffmanTable;
  litlenLengths: RleEntry[];
  distLengths: RleEntry[];
};

export type RleEntry = {
  codeRange: BitRange;
  extraRange?: BitRange;
  kind: 'literal' | 'copy-prev' | 'zeros';
  value: number;
  expandedLengths: number[];
  expandedIndex: number;
};

export type Symbol =
  | { kind: 'literal'; value: number; bitRange: BitRange; outputIndex: number }
  | {
      kind: 'match';
      length: number; distance: number;
      lengthCodeRange: BitRange; lengthExtraRange?: BitRange;
      distCodeRange: BitRange;   distExtraRange?: BitRange;
      outputStart: number; outputEnd: number;
      backrefStart: number; backrefEnd: number;
    }
  | { kind: 'end-of-block'; bitRange: BitRange };

export type HuffmanTable = {
  lengths: number[];
  lookup: Uint16Array;
  maxBits: number;
  symbolsByCode: { code: number; bits: number; symbol: number }[];
};

export type ParseError = {
  severity: 'fatal' | 'soft';
  message: string;
  bitPos?: number;
  bitRange?: BitRange;
};
