import { useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';
import { findSelectionAtOutputByte } from '../../state/find-at-output';

// Inline-rendering cap. Most inputs fit in one window; larger ones get a sliding
// window anchored on the current selection so any block's output stays visible.
const WINDOW_CHARS = 200_000;

type Range = { start: number; end: number };

export function OutputTextTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const setSelection = useUiStore(s => s.setSelection);
  const resolved = useMemo(() => resolveSelection(selection, parsed), [selection, parsed]);

  const text = useMemo(() => {
    if (!parsed) return '';
    try { return new TextDecoder('utf-8', { fatal: false }).decode(parsed.decoded); }
    catch { return ''; }
  }, [parsed]);

  // Compute a visible window that always contains the current highlight + backref
  // (when a selection exists). Falls back to the first WINDOW_CHARS chars otherwise.
  const { sliceStart, slice } = useMemo(() => {
    return computeWindow(text, resolved.outputRange, resolved.backrefRange, WINDOW_CHARS);
  }, [text, resolved.outputRange, resolved.backrefRange]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resolved.outputRange || !containerRef.current) return;
    const sel = containerRef.current.querySelector<HTMLElement>('.span.hi');
    sel?.scrollIntoView({ block: 'nearest' });
  }, [resolved.outputRange, sliceStart]);

  if (!parsed) return null;

  // Translate absolute byte ranges into offsets within the current window.
  const hi = clampToWindow(resolved.outputRange, sliceStart, slice.length);
  const backref = clampToWindow(resolved.backrefRange, sliceStart, slice.length);
  const segments = buildSegments(slice.length, hi, backref);

  const onByteClick = (posInWindow: number) => {
    if (parsed) setSelection(findSelectionAtOutputByte(parsed, sliceStart + posInWindow));
  };

  const truncatedBefore = sliceStart;
  const truncatedAfter = Math.max(0, text.length - (sliceStart + slice.length));

  return (
    <div className="output-text" ref={containerRef}>
      {truncatedBefore > 0 && (
        <div style={{ color: '#6c7388', fontSize: 11, marginBottom: 8 }}>
          … {truncatedBefore.toLocaleString()} earlier bytes hidden; window anchored on current selection.
        </div>
      )}
      {segments.map((seg, i) => (
        <span
          key={i}
          className={`span ${seg.cls}`}
          onClick={() => onByteClick(seg.start)}
          style={{ cursor: seg.cls ? 'pointer' : 'text' }}
        >
          {slice.slice(seg.start, seg.end)}
        </span>
      ))}
      {(resolved.outputRange || resolved.backrefRange) && (
        <div style={{ marginTop: 12, fontSize: 11, color: '#9aa3b2' }}>
          {resolved.outputRange && (
            <>destination @ bytes {resolved.outputRange.start.toLocaleString()}–{resolved.outputRange.end.toLocaleString()}</>
          )}
          {resolved.outputRange && resolved.backrefRange && ' · '}
          {resolved.backrefRange && (
            <>back-ref source @ bytes {resolved.backrefRange.start.toLocaleString()}–{resolved.backrefRange.end.toLocaleString()}</>
          )}
        </div>
      )}
      {truncatedAfter > 0 && (
        <div style={{ marginTop: 12, color: '#6c7388', fontSize: 11 }}>
          … {truncatedAfter.toLocaleString()} more bytes truncated (total decoded: {text.length.toLocaleString()} bytes).
        </div>
      )}
    </div>
  );
}

// Pick a [sliceStart, sliceStart+sliceLen) window out of `text`, large enough to
// contain the selection's ranges when one exists. If the full text fits, just
// render all of it. If not, anchor around the union of the selection ranges,
// keeping some context on either side.
function computeWindow(
  text: string,
  hi: Range | null | undefined,
  backref: Range | null | undefined,
  cap: number,
): { sliceStart: number; slice: string } {
  if (text.length <= cap) return { sliceStart: 0, slice: text };

  const ranges = [hi, backref].filter((r): r is Range => !!r);
  if (ranges.length === 0) return { sliceStart: 0, slice: text.slice(0, cap) };

  const lo = Math.min(...ranges.map(r => r.start));
  const hiEnd = Math.max(...ranges.map(r => r.end));

  // Center the window on the selection span when possible.
  const span = hiEnd - lo;
  const padding = Math.max(0, Math.floor((cap - span) / 2));
  let start = Math.max(0, lo - padding);
  let end = Math.min(text.length, start + cap);
  if (end === text.length) start = Math.max(0, end - cap);

  return { sliceStart: start, slice: text.slice(start, end) };
}

function clampToWindow(r: Range | null | undefined, sliceStart: number, sliceLen: number): Range | null {
  if (!r) return null;
  const start = Math.max(0, Math.min(r.start - sliceStart, sliceLen));
  const end = Math.max(start, Math.min(r.end - sliceStart, sliceLen));
  return start === end ? null : { start, end };
}

function buildSegments(len: number, hi: Range | null, backref: Range | null): { start: number; end: number; cls: string }[] {
  if (len === 0) return [];
  const cuts = new Set<number>([0, len]);
  if (hi) { cuts.add(hi.start); cuts.add(hi.end); }
  if (backref) { cuts.add(backref.start); cuts.add(backref.end); }
  const points = [...cuts].sort((a, b) => a - b);
  const out: { start: number; end: number; cls: string }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start >= end) continue;
    const inHi = hi && start >= hi.start && end <= hi.end;
    const inBr = backref && start >= backref.start && end <= backref.end;
    const cls = inHi ? 'hi' : inBr ? 'backref' : '';
    out.push({ start, end, cls });
  }
  return out;
}
