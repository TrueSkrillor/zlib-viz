import { create } from 'zustand';
import type { BitRange, ParsedStream } from '../parser/types';

export type Selection =
  | { kind: 'none' }
  | { kind: 'wrapper' }
  | { kind: 'trailer' }
  | { kind: 'block'; blockIndex: number }
  | { kind: 'blockField'; blockIndex: number; fieldPath: (string | number)[] }
  | { kind: 'blockSection'; blockIndex: number; section: 'huffman-tables' | 'symbols' }
  | { kind: 'symbol'; blockIndex: number; symbolIndex: number };

export type Depth = 1 | 2 | 3;

export function isExpanded(id: string, expansion: Record<string, boolean>): boolean {
  // "symbols:*" groups default collapsed (large blocks would drown the tree).
  // Everything else (block:*) defaults expanded.
  const override = expansion[id];
  if (override !== undefined) return override;
  return !id.startsWith('symbols:');
}

export type UiState = {
  parsed: ParsedStream | null;
  inputBytes: Uint8Array | null;
  selection: Selection;
  hover: BitRange | null;
  depth: Depth;
  expansion: Record<string, boolean>;
  bytesPaneTab: 'hex' | 'bits';
  structurePaneTab: 'tree' | 'bit-layout' | 'huffman' | 'code-len';
  outputPaneTab: 'text' | 'hex' | 'tokens';
  setParsed: (p: ParsedStream | null, bytes?: Uint8Array) => void;
  setSelection: (s: Selection) => void;
  setHover: (h: BitRange | null) => void;
  setDepth: (d: Depth) => void;
  toggleExpand: (id: string) => void;
  setBytesPaneTab: (t: UiState['bytesPaneTab']) => void;
  setStructurePaneTab: (t: UiState['structurePaneTab']) => void;
  setOutputPaneTab: (t: UiState['outputPaneTab']) => void;
};

export const useUiStore = create<UiState>((set) => ({
  parsed: null,
  inputBytes: null,
  selection: { kind: 'none' },
  hover: null,
  depth: 3,
  expansion: {},
  bytesPaneTab: 'hex',
  structurePaneTab: 'tree',
  outputPaneTab: 'text',
  setParsed: (parsed, bytes = undefined) => set({
    parsed, inputBytes: bytes ?? null,
    selection: { kind: 'none' }, hover: null,
    expansion: {},
  }),
  setSelection: (selection) => set({ selection }),
  setHover: (hover) => set({ hover }),
  setDepth: (depth) => set({ depth }),
  toggleExpand: (id) => set((s) => ({
    expansion: { ...s.expansion, [id]: !isExpanded(id, s.expansion) },
  })),
  setBytesPaneTab: (bytesPaneTab) => set({ bytesPaneTab }),
  setStructurePaneTab: (structurePaneTab) => set({ structurePaneTab }),
  setOutputPaneTab: (outputPaneTab) => set({ outputPaneTab }),
}));
