import { create } from 'zustand';
import type { BitRange, ParsedStream } from '../parser/types';

export type Selection =
  | { kind: 'none' }
  | { kind: 'wrapper' }
  | { kind: 'trailer' }
  | { kind: 'block'; blockIndex: number }
  | { kind: 'blockField'; blockIndex: number; fieldPath: (string | number)[] }
  | { kind: 'symbol'; blockIndex: number; symbolIndex: number };

export type Depth = 1 | 2 | 3;

export type UiState = {
  parsed: ParsedStream | null;
  selection: Selection;
  hover: BitRange | null;
  depth: Depth;
  bytesPaneTab: 'hex' | 'bits';
  structurePaneTab: 'tree' | 'bit-layout' | 'huffman' | 'code-len';
  outputPaneTab: 'text' | 'hex' | 'tokens';
  setParsed: (p: ParsedStream | null) => void;
  setSelection: (s: Selection) => void;
  setHover: (h: BitRange | null) => void;
  setDepth: (d: Depth) => void;
  setBytesPaneTab: (t: UiState['bytesPaneTab']) => void;
  setStructurePaneTab: (t: UiState['structurePaneTab']) => void;
  setOutputPaneTab: (t: UiState['outputPaneTab']) => void;
};

export const useUiStore = create<UiState>((set) => ({
  parsed: null,
  selection: { kind: 'none' },
  hover: null,
  depth: 3,
  bytesPaneTab: 'hex',
  structurePaneTab: 'tree',
  outputPaneTab: 'text',
  setParsed: (parsed) => set({ parsed, selection: { kind: 'none' }, hover: null }),
  setSelection: (selection) => set({ selection }),
  setHover: (hover) => set({ hover }),
  setDepth: (depth) => set({ depth }),
  setBytesPaneTab: (bytesPaneTab) => set({ bytesPaneTab }),
  setStructurePaneTab: (structurePaneTab) => set({ structurePaneTab }),
  setOutputPaneTab: (outputPaneTab) => set({ outputPaneTab }),
}));
