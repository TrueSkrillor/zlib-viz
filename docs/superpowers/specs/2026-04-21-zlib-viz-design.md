# zlib-viz — Design Spec

**Date:** 2026-04-21
**Status:** Approved design, ready for implementation planning.

## 1. Purpose

A browser-based static web app that visualizes the internal structure of a zlib / gzip / raw-DEFLATE compressed stream. Two overlapping use cases:

- **Educational** — see exactly how DEFLATE works, block by block, codeword by codeword, by pointing at small example files.
- **Research** — inspect real-world compressed blobs (PNG IDAT, HTTP bodies, PDF streams, ZIP members, arbitrary buffers) to understand or diagnose them.

## 2. Scope

### In scope
- Parsing of RFC 1950 (zlib), RFC 1951 (DEFLATE), and RFC 1952 (gzip).
- Auto-detection of format from magic bytes.
- Full bit-level decomposition including the dynamic-Huffman meta-structure (HLIT/HDIST/HCLEN, code-length code lengths, RLE-encoded lit/len and distance code-length arrays, final Huffman trees).
- Interactive UI with cross-pane highlighting between raw bits, parsed structure, and decoded output.
- A runtime depth selector exposing three rendering levels:
  - **L1** — wrapper + block list + trailer only.
  - **L2** — L1 + per-block Huffman tables and decoded symbol list.
  - **L3** — L2 + bit-level detail of every field (dynamic meta, per-codeword bit ranges).
- Input methods: drag-and-drop, file picker, paste as hex or base64, built-in examples library.
- Upper file size target: ~10 MB input (decoded up to ~50 MB).

### Out of scope
- Compression (encoding) — the tool only decodes.
- ZIP / PNG / PDF container parsing — if the user wants to look at the IDAT bytes of a PNG, they extract those bytes externally and drop them in.
- Fetching inputs from a URL (avoids CORS complexity; paste workflow covers the use case).
- Streaming parse of files > 10 MB.
- Mobile / small-screen layout — desktop-class viewport assumed.

## 3. Constraints & non-functional requirements

- **Static client-side app** — no backend. Must be servable from any static host or opened as a file.
- **Parser runs in a Web Worker** so parsing a 10 MB input does not block the UI.
- **Parser is pure and UI-independent** — takes `Uint8Array`, returns `ParsedStream`. Can be reused from a CLI, tests, or another UI without modification.
- **Tech stack** — TypeScript + Vite + React. State with Zustand. Virtualization with `react-window`. Huffman-tree rendering with hand-written SVG (no d3). Tests with Vitest + fast-check; UI smoke tests with Playwright.
- **Correctness is the bar** — decoded output must match Node's native `zlib` for every fixture and every property-test input.
- **Minimal comments** — only explain non-obvious bits (hidden invariants, RFC-specific constants, subtle bit ordering). Well-named identifiers and types are the primary documentation.

## 4. Architecture

Four layers, each with a single responsibility and a clear interface:

```
┌─ UI (React)  ─────────────────────────────────────────┐
│  InputArea · TopBar+DepthSelector · BlockTimeline     │
│  ThreePane { BytesPane · StructurePane · OutputPane } │
│  — cross-highlight driven by a single selection store │
└─────────────────────────────▲─────────────────────────┘
                              │  ParsedStream (immutable; delivered once via postMessage)
┌─ Worker boundary ────────────┴─────────────────────────┐
│  parse-worker.ts — format-detect → wrapper → deflate  │
│  posts {type:'progress'} per block; {type:'done'}     │
│  on success; {type:'error', partialParsed?} on fail   │
└─────────────────────────────▲─────────────────────────┘
                              │
┌─ Parser core (pure TS) ──────┴─────────────────────────┐
│  BitReader · HuffmanTable · FormatDetect              │
│  ZlibFrame · GzipFrame · DeflateDecoder               │
└───────────────────────────────────────────────────────┘

┌─ Shared types ───────────────────────────────────────┐
│  ParsedStream · Block · Symbol · BitRange · …        │
└──────────────────────────────────────────────────────┘
```

### Module layout

- `src/parser/bit-reader.ts` — LSB-first bit extraction with monotonic bit-position tracking.
- `src/parser/huffman.ts` — canonical Huffman-table builder + fast decoder.
- `src/parser/format-detect.ts` — sniff zlib / gzip / raw DEFLATE from the first bytes.
- `src/parser/zlib-frame.ts` — RFC 1950 wrapper (CMF, FLG, ADLER32).
- `src/parser/gzip-frame.ts` — RFC 1952 wrapper (ID1/ID2, flags, optional FNAME/FCOMMENT/FEXTRA, CRC16 header, CRC32, ISIZE).
- `src/parser/deflate.ts` — RFC 1951 block loop.
- `src/parser/types.ts` — `ParsedStream` and nested types.
- `src/worker/parse-worker.ts` — worker entrypoint; owns the message protocol.
- `src/state/selection.ts` — Zustand store (selection, hover, depth, pane-tab prefs).
- `src/state/resolve-selection.ts` — derives `BitRange`s from a selection for the panes to consume.
- `src/ui/App.tsx`, `src/ui/Viewer.tsx`, and one file per pane & tab (see §6).
- `src/examples/` — canned sample files (stored, fixed-huffman, dynamic, gzip, raw, edge cases).

## 5. Data model

Every range the UI can highlight is expressed in bit coordinates from the start of the input. That single convention makes cross-highlighting trivial.

```ts
type BitRange = { start: number; end: number };          // half-open, bits from input[0]

type ParsedStream = {
  format: 'zlib' | 'gzip' | 'raw-deflate';
  totalBytes: number;
  wrapper?: ZlibWrapper | GzipWrapper;
  blocks: Block[];
  trailer?: Adler32 | GzipTrailer;
  decoded: Uint8Array;                                    // full decoded output
  errors: ParseError[];                                   // non-fatal + fatal issues
};

type Block = {
  index: number;
  bfinal: boolean;
  btype: 'stored' | 'fixed' | 'dynamic';
  range: BitRange;                                        // whole block incl. header
  headerRange: BitRange;                                  // BFINAL + BTYPE
  body: StoredBody | HuffmanBody;
  outputRange: { start: number; end: number };           // byte range into decoded
};

type StoredBody = {
  lenRange: BitRange;                                     // LEN / NLEN bytes
  bytes: Uint8Array;                                      // raw payload
  payloadRange: BitRange;
};

type HuffmanBody = {
  litlenTable: HuffmanTable;
  distTable: HuffmanTable;
  dynamicMeta?: DynamicMeta;                              // absent for fixed blocks
  symbols: Symbol[];
};

type DynamicMeta = {
  hlit: number; hdist: number; hclen: number;
  hlitRange: BitRange; hdistRange: BitRange; hclenRange: BitRange;
  codeLenCodeLengths: { value: number; range: BitRange }[];   // 16 × 3 bits in permutation order
  codeLenTable: HuffmanTable;
  litlenLengths: RleEntry[];                              // RLE instructions + expansions
  distLengths: RleEntry[];
};

type RleEntry = {
  codeRange: BitRange;                                    // bits of the 0..18 code
  extraRange?: BitRange;                                  // bits of extra (for 16/17/18)
  kind: 'literal' | 'copy-prev' | 'zeros';
  value: number;                                          // length emitted (for literal) / count (for 16/17/18)
  expandedLengths: number[];                              // the lengths this entry produced
  expandedIndex: number;                                  // starting index in the target alphabet
};

type Symbol =
  | { kind: 'literal'; value: number; bitRange: BitRange; outputIndex: number }
  | { kind: 'match';
      length: number; distance: number;
      lengthCodeRange: BitRange; lengthExtraRange?: BitRange;
      distCodeRange: BitRange;   distExtraRange?: BitRange;
      outputStart: number; outputEnd: number;             // destination slice in decoded
      backrefStart: number; backrefEnd: number }          // source slice in decoded
  | { kind: 'end-of-block'; bitRange: BitRange };

type HuffmanTable = {
  lengths: number[];                                      // original code length per symbol
  lookup: Uint16Array;                                    // flat canonical lookup table
  maxBits: number;
  symbolsByCode: { code: number; bits: number; symbol: number }[];  // for tree visualisation
};

type ParseError = {
  severity: 'fatal' | 'soft';
  message: string;
  bitPos?: number;
  bitRange?: BitRange;
};
```

## 6. UI component tree

```
<App>
  <InputArea>
    <ExampleLibrary />
    <HexPasteModal />
  </InputArea>

  {parsed && (
    <Viewer>
      <TopBar>                     // filename, auto-detected format pill, size pills
        <DepthSelector />          // L1 / L2 / L3 — controls tree expansion + tab availability
      </TopBar>

      <BlockTimeline />            // horizontal strip proportional to compressed size,
                                   // colored by block type, click to select

      <ThreePane>
        <BytesPane>                // Tabs: Hex | Bit stream   (virtualized rows)
          <HexTab />
          <BitStreamTab />
        </BytesPane>

        <StructurePane>            // Tabs: Tree | Bit layout | Huffman trees | Code-len alphabet
          <TreeTab />              // collapsible, virtualized; depth selector gates expansion
          <BitLayoutTab />         // horizontally scrolling bit ruler for the selected block
          <HuffmanTreesTab />      // SVG tidy-trees for litlen + dist (+ code-len if dynamic)
          <CodeLenAlphabetTab />   // 16 × 3-bit entries + RLE expansion table
        </StructurePane>

        <OutputPane>               // Tabs: Text | Hex | Tokens
          <TextTab />              // UTF-8 render with LZ77 arc overlays (SVG layer)
          <HexTab />               // decoded bytes as hex
          <TokensTab />            // literal/match token list, scroll-synced to Structure
        </OutputPane>
      </ThreePane>
    </Viewer>
  )}
</App>
```

### Depth-selector semantics

| Depth | Tree | Tabs available |
|---|---|---|
| L1 | Wrapper + blocks + trailer only | Tree only |
| L2 | + Huffman tables, symbols list | + Huffman trees |
| L3 | + Every bit-level field (headers, RLE meta, per-codeword ranges) | + Bit layout, Code-len alphabet |

Changing depth is instant: the parsed data is always complete, the depth selector only affects rendering.

### Virtualization

`BytesPane` (hex + bits), `OutputPane` (all tabs), and `StructurePane/TreeTab` all use `react-window` with fixed row heights (one row = 16 input bytes for hex; one row = one tree node for Tree; one row = one symbol for Tokens). This keeps render work O(visible rows) regardless of input size.

### LZ77 arrows

`OutputPane/TextTab` renders an absolutely-positioned SVG overlay on top of the text. For each match currently visible in the viewport *and* belonging to the selected block, draw an arc from its destination slice back to its source slice. Limiting the set keeps the overlay fast even for large outputs.

## 7. State & interactions

A single Zustand store:

```ts
type UiState = {
  parsed: ParsedStream | null;

  selection: {
    kind: 'none' | 'wrapper' | 'block' | 'blockField' | 'symbol' | 'trailer';
    blockIndex?: number;
    fieldPath?: (string | number)[];                      // e.g. ['dynamicMeta','codeLenCodeLengths',7]
    symbolIndex?: number;
  };

  hover: BitRange | null;                                 // transient cross-pane highlight

  depth: 1 | 2 | 3;
  bytesPaneTab: 'hex' | 'bits';
  structurePaneTab: 'tree' | 'bit-layout' | 'huffman' | 'code-len';
  outputPaneTab: 'text' | 'hex' | 'tokens';
};
```

A single pure helper, `resolveSelection(selection, parsed) → { bitRange, outputRange, backrefRange? }`, encapsulates stream traversal. Every pane subscribes to its output; panes contain no stream-walking logic.

### Interaction matrix

| Action | Primary effect | Secondary effect |
|---|---|---|
| Click a byte/bit in BytesPane | `selection` = innermost node containing that bit | Timeline highlights parent block; Structure auto-scrolls + expands the tree path; Output scrolls to `outputRange` |
| Click a node in the tree | `selection` = that node | Bytes pane scrolls to `range.start` and highlights; Output scrolls to `outputRange` |
| Click a block in the timeline | `selection.kind` = `'block'`, `blockIndex` set | Panes retarget to that block |
| Click a token in Tokens / arc in Text | `selection.kind` = `'symbol'` | Bytes pane highlights `bitRange`; Structure scrolls; match selections additionally highlight `backrefRange` in Output |
| Hover anywhere | `hover` = relevant `BitRange` | Low-key cross-pane highlight, no scroll |
| Change depth | `depth` updates | Tree re-renders; disabled tabs gray out and redirect to Tree |

### Worker message protocol

- UI → worker: `{ type: 'parse', bytes: Uint8Array }` (transferred).
- Worker → UI: `{ type: 'progress', blocksDone: number, bytesConsumed: number }` after each block.
- Worker → UI on success: `{ type: 'done', parsed: ParsedStream }`.
- Worker → UI on failure: `{ type: 'error', message: string, partialParsed?: ParsedStream }` — if any blocks parsed successfully before the failure, `partialParsed` lets the user still explore them.

UI shows a determinate progress bar fed by `bytesConsumed / totalBytes`.

## 8. Parser details

### BitReader

LSB-first bit order as DEFLATE requires. Public surface:

```ts
class BitReader {
  constructor(bytes: Uint8Array);
  readonly bitPos: number;                  // monotonic
  readBits(n: number): number;              // 1 ≤ n ≤ 16
  peek(n: number): number;                  // no advance; for Huffman lookup
  advance(n: number): void;
  alignToByte(): void;
  readBytes(n: number): Uint8Array;         // byte-aligned
  eof(): boolean;
}
```

### DEFLATE decoder flow

For each block:

1. Read `BFINAL (1)`, `BTYPE (2)` → mark `headerRange`.
2. **Stored (BTYPE=00)**: `alignToByte()`, read `LEN (16)` and `NLEN (16)`, assert `LEN == ~NLEN`, read `LEN` raw bytes.
3. **Fixed (BTYPE=01)**: build fixed tables from the RFC 1951 canonical lengths, then decode symbols.
4. **Dynamic (BTYPE=10)**:
   1. Read `HLIT (5)`, `HDIST (5)`, `HCLEN (4)`; mark each.
   2. Read `HCLEN + 4` code-length-code lengths (3 bits each) in fixed permutation order `16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15`. Record each entry's `BitRange`.
   3. Build the code-length Huffman table.
   4. Decode `HLIT + 257` lit/len code lengths and `HDIST + 1` distance code lengths, expanding RLE codes 16 (copy-prev 3–6), 17 (zeros 3–10), 18 (zeros 11–138). Emit one `RleEntry` per code decoded, with its `codeRange`, optional `extraRange`, and resulting `expandedLengths`.
   5. Build `litlenTable` and `distTable`.
5. **Symbol loop**: decode a lit/len symbol.
   - `< 256` → literal: write one byte to the output, emit a `literal` Symbol.
   - `== 256` → end-of-block: emit `end-of-block` Symbol, exit the loop.
   - `> 256` → length base + extra bits; then decode a distance symbol, distance base + extra bits; copy `length` bytes from `outputLength - distance`; emit a `match` Symbol with destination and source slices.

Throughout, every `readBits` / `peek + advance` records a `BitRange` into whichever field triggered it. Output byte position and bit position are tracked in parallel and embedded in emitted nodes.

### Format detection

From the first 1–2 bytes:

- `input[0] == 0x1F && input[1] == 0x8B` → gzip.
- Otherwise, if `(input[0] & 0x0F) == 8` *and* `((input[0] * 256 + input[1]) % 31) == 0` → zlib.
- Otherwise → raw DEFLATE.

If zlib/gzip detection succeeds but the body fails to decode, the error is reported against the detected format; we do not retry as raw.

## 9. Error handling

Three kinds, treated differently:

| Kind | Examples | Handling |
|---|---|---|
| **Malformed input** (fatal) | Unexpected EOF mid-block; undefined Huffman code; `HCLEN` inconsistent with stream length; `LEN != ~NLEN` in stored block | Stop parsing *the current block*; push `ParseError { severity:'fatal', bitPos, message }`; return `partialParsed` with every prior successfully-parsed block |
| **Invariant violation** (soft) | Adler32 mismatch; gzip CRC32 mismatch; gzip ISIZE mismatch; stream ended without a `BFINAL=1` block | Keep the full `ParsedStream`; add `ParseError { severity:'soft', bitRange }`; UI flags the offending wrapper / trailer / block node |
| **Programmer bug** (unexpected) | `BitReader.readBits(33)`; invariant assertion failure inside `HuffmanTable` builder | Throw. The worker harness catches, converts to `{type:'error', message}`, and posts to the UI |

The UI renders `errors[]` as a dismissible banner and inline red markers on the tree nodes whose `bitRange` overlaps each error. A partially-parsed stream is always fully explorable up to the failure point — critical for research.

## 10. Testing strategy

### Layer 1 — Unit tests on parser primitives (Vitest)

- `BitReader`: exhaustive read/peek/align patterns; byte-edge boundaries; past-EOF behavior.
- `HuffmanTable`: builds RFC 1951 fixed tables correctly; rejects non-canonical length arrays; round-trips against hand-derived bit strings.
- `format-detect`: all three positive cases plus zlib checksum boundary cases.

### Layer 2 — Integration tests (Vitest + fixtures)

Fixtures checked into `test/fixtures/`:

- `empty.zlib` (zero-length input)
- `stored-only.zlib` (BTYPE=0)
- `fixed-huffman.zlib` (short text compressing to fixed)
- `dynamic-small.zlib`, `dynamic-large.zlib`
- `multi-block.zlib` (≥3 blocks of mixed types)
- `gzip-plain.gz`, `gzip-with-name.gz`
- `raw-deflate.bin`
- `truncated.zlib`, `bad-adler.zlib`, `bad-crc.gz` (negative cases)

For each positive fixture:

- `parsed.decoded` equals Node's native `zlib` output byte-for-byte (ground truth).
- Offset invariants hold: every `BitRange.end ≤ totalBytes * 8`; every block's `range` exactly covers its children; every symbol's `outputRange` is contiguous with its neighbors inside the block; the concatenation of all block `outputRange`s equals `[0, decoded.length)`.

For each negative fixture: the appropriate `errors[]` entries exist at the expected `bitRange`; `partialParsed` contains the expected prefix of successful blocks.

### Layer 3 — Property tests (Vitest + fast-check)

- Generator: random `Uint8Array` of length 0–8 KB, compressed via Node's `zlib.deflateSync` / `gzipSync`.
- Property: our parser's `decoded` equals the input; every offset invariant from Layer 2 holds.

### Layer 4 — UI smoke tests (Playwright, minimal)

- Each example file drops in and renders without console errors.
- L1 / L2 / L3 switching leaves the app in a consistent state; disabled tabs gray out.
- Clicking a byte in BytesPane expands the tree to the matching node and scrolls Output into view.
- Clicking a match token highlights its source region in Output.

Layers 1–3 establish correctness — that is the bar. Layer 4 catches UI wiring regressions but is deliberately thin; detailed UI correctness is enforced by types and the single selection-resolution helper rather than by end-to-end tests.

## 11. Open items

None. All design decisions above are resolved. Any further ambiguity should surface during implementation planning.
