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

export function isExpanded(id: string, expansion: Record<string, boolean>): boolean {
  // All collapsible rows default closed. The tree opens to a clean minimal
  // view (wrapper + blocks + trailer) and the user drills in as needed;
  // setSelection auto-expands ancestors when a byte click targets a row
  // inside a collapsed branch.
  const override = expansion[id];
  if (override !== undefined) return override;
  return false;
}

function ensureAncestorsExpanded(
  selection: Selection,
  expansion: Record<string, boolean>,
): Record<string, boolean> {
  const needsOpen: string[] = [];
  if (selection.kind === 'symbol') {
    needsOpen.push(`block:${selection.blockIndex}`, `symbols:${selection.blockIndex}`);
  } else if (selection.kind === 'blockField' || selection.kind === 'blockSection') {
    needsOpen.push(`block:${selection.blockIndex}`);
  }
  let next = expansion;
  for (const id of needsOpen) {
    if (!isExpanded(id, next)) {
      if (next === expansion) next = { ...expansion };
      next[id] = true;
    }
  }
  return next;
}

export type UiState = {
  parsed: ParsedStream | null;
  inputBytes: Uint8Array | null;
  selection: Selection;
  hover: BitRange | null;
  expansion: Record<string, boolean>;
  bytesPaneTab: 'hex' | 'bits';
  structurePaneTab: 'tree' | 'bit-layout' | 'huffman' | 'code-len';
  outputPaneTab: 'text' | 'hex' | 'tokens';
  setParsed: (p: ParsedStream | null, bytes?: Uint8Array) => void;
  setSelection: (s: Selection) => void;
  setHover: (h: BitRange | null) => void;
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
  expansion: {},
  bytesPaneTab: 'hex',
  structurePaneTab: 'tree',
  outputPaneTab: 'text',
  setParsed: (parsed, bytes = undefined) => set({
    parsed, inputBytes: bytes ?? null,
    selection: { kind: 'none' }, hover: null,
    expansion: {},
  }),
  setSelection: (selection) => set((s) => {
    // Auto-expand the ancestor rows of the new selection so the matching
    // tree row becomes visible when the user clicks into a symbol or a
    // block sub-field from the bytes / decoded panes.
    const expansion = ensureAncestorsExpanded(selection, s.expansion);
    return expansion === s.expansion ? { selection } : { selection, expansion };
  }),
  setHover: (hover) => set({ hover }),
  toggleExpand: (id) => set((s) => ({
    expansion: { ...s.expansion, [id]: !isExpanded(id, s.expansion) },
  })),
  setBytesPaneTab: (bytesPaneTab) => set({ bytesPaneTab }),
  setStructurePaneTab: (structurePaneTab) => set({ structurePaneTab }),
  setOutputPaneTab: (outputPaneTab) => set({ outputPaneTab }),
}));
