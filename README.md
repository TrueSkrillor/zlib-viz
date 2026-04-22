# zlib-viz

An interactive, browser-based visualiser for **zlib** (RFC 1950), **gzip** (RFC 1952), and **raw DEFLATE** (RFC 1951) compressed streams. Drop a compressed file into the app and see its structure decomposed all the way down to individual Huffman codewords and LZ77 back-references, with every field linked to the bit range it occupies in the input.

Built as a single-page static web app — no backend, no telemetry, no upload. Parsing happens in a Web Worker on your machine.

## Why

Existing DEFLATE decoders (`zlib`, `pako`, `fflate`, etc.) give you the decompressed output but discard every intermediate artefact. They won't tell you:

- Which bit the code-length alphabet starts at.
- Which Huffman codeword encodes the literal `'H'` at output byte 0.
- Which source region an LZ77 back-reference copied from.
- Why a particular stream is 5 bytes bigger than it could be.

**zlib-viz** instruments its own decoder so every field, every symbol, and every back-reference carries its exact bit range. The UI lets you hover or click anywhere — raw bytes, parsed tree, decoded output — and the other two panes light up the corresponding region.

It's intended for two audiences:

- **Students and educators** learning how DEFLATE works. The tree decomposes every block down to individual bit fields; use the caret on "Block N" or "symbols (N)" to collapse detail you don't need.
- **Researchers and engineers** poking at real-world compressed blobs from PNG chunks, HTTP bodies, PDF streams, or arbitrary buffers.

## Features

- Auto-detects zlib / gzip / raw DEFLATE from the magic bytes.
- Full bit-level decomposition — wrapper header, every block header, the dynamic-Huffman meta region (HLIT/HDIST/HCLEN, code-length code lengths, RLE-encoded lit/len and distance code lengths), every literal, every match with its back-reference region.
- Three linked, virtualised panes — raw **Bytes** (hex or bit stream), parsed **Structure** (collapsible tree, bit-layout ruler, Huffman alphabet tables, code-length alphabet), and **Decoded output** (text, hex, or token list).
- Every block and its symbols group is collapsible in the tree; the "symbols (N)" subtree defaults to collapsed to keep large blocks scannable.
- Block timeline strip across the top, colour-coded by block type and sized proportionally to compressed bytes.
- Drag-and-drop, file picker, hex/base64 paste, and a built-in examples library.
- Parses up to ~10 MB inputs in a Web Worker so the UI stays responsive.
- ADLER32 and CRC32/ISIZE verified and surfaced as inline soft errors on mismatch; malformed blocks produce a `partialParsed` result so you can still explore everything that parsed successfully.

## Screenshots

Open one of the built-in examples to see the three-pane viewer in action — a click in the structure tree highlights the matching bits in the **Bytes · Bits** pane on the left and the matching region of decoded output on the right.

## Getting started

### Prerequisites

- Node.js 20 or newer
- npm (bundled with Node)

### Install and run

```bash
git clone <repository-url>
cd zlib-viz
npm install
npm run dev
```

Vite prints a local URL (default `http://localhost:5173`). Open it in any modern browser.

### Build a production bundle

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built bundle locally
```

The bundle is a static set of files — drop `dist/` on any static host (GitHub Pages, S3, nginx, etc.). There is no backend.

## Usage

From the landing page you can:

1. **Drag a file** onto the drop zone.
2. **Click "Choose file"** to pick one from disk.
3. **Click "Paste bytes"** to paste hex or base64 (useful for bytes in a log or a debugger inspector).
4. **Pick a built-in example** (stored, fixed Huffman, dynamic Huffman, gzip, or raw DEFLATE).

Once parsed, the viewer opens. Any selection or hover in one pane is reflected in the other two:

- **Bytes pane** (left): hex dump and bit stream. Click any byte/bit to select the innermost structural node containing it.
- **Structure pane** (middle): the parsed tree. Click the caret to collapse/expand a block or the symbols group. Switch tabs for a horizontal bit-layout ruler, sorted Huffman codeword tables, or the code-length alphabet + RLE expansion view.
- **Output pane** (right): decoded text, decoded hex, or the literal/match token list. Selecting a match token highlights its source region.

## Tech stack

TypeScript · Vite · React · Zustand · react-window · Vitest · fast-check · Playwright.

## Development

```bash
npm run dev              # dev server with HMR
npm run typecheck        # tsc -b --noEmit
npm test                 # vitest run — 68 tests (unit + integration + property)
npm test -- <file>       # single test file
npm run test:watch       # vitest in watch mode
npm run e2e              # Playwright smoke suite (launches its own dev server)
npm run build            # production build

# Regenerate binary fixtures from their source strings:
npx tsx test/parser/fixtures/generate.ts
```

### Testing approach

- **Unit tests** on every parser primitive (`BitReader`, `HuffmanTable`, `detectFormat`, stored/fixed/dynamic DEFLATE block parsing, zlib and gzip wrappers).
- **Integration tests** that decode checked-in fixtures and assert **byte-for-byte equality with Node's native `zlib`**, plus bit-range invariants (every block covers its children exactly, every symbol's output range is contiguous with its neighbours).
- **Property tests** with fast-check — ~280 randomly generated inputs per format (zlib / gzip / raw) round-trip byte-for-byte.
- **Playwright smoke tests** cover the viewer wiring (load an example, switch depth, click a byte → matching tree node becomes active).

### Repository layout

```
src/
  parser/      Pure-TS instrumented DEFLATE/zlib/gzip parser (no DOM)
  worker/      Web Worker that hosts the parser, plus a typed client
  state/       Zustand store, selection resolution, bit-to-selection lookup
  ui/          React panes, tabs, and the three-pane viewer shell
  examples/    Built-in example registry (served from public/examples/)

test/          Vitest tests + fast-check property tests + generated fixtures
e2e/           Playwright smoke tests
docs/          Design spec and implementation plan
```

`CLAUDE.md` has the architecture deep-dive (bit-addressed data model, selection kinds, gotchas, parser invariants) if you're digging in.

## Design and implementation documents

The design and implementation plan live in the repo:

- [`docs/superpowers/specs/2026-04-21-zlib-viz-design.md`](docs/superpowers/specs/2026-04-21-zlib-viz-design.md) — approved design spec (scope, architecture, data model, UI, state, error handling, testing strategy).
- [`docs/superpowers/plans/2026-04-21-zlib-viz.md`](docs/superpowers/plans/2026-04-21-zlib-viz.md) — the 28-task implementation plan that produced the initial version.

## License

[MIT](LICENSE) © 2026 Fabian Bäumer

---

> This project was written using [Claude Code](https://claude.com/claude-code) with Opus 4.7 (1M context).
