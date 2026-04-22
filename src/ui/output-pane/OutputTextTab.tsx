import { useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';
import { findSelectionAtOutputByte } from '../../state/find-at-output';

const MAX_VISIBLE = 50_000;

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

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resolved.outputRange || !containerRef.current) return;
    const sel = containerRef.current.querySelector<HTMLElement>('.span.hi');
    sel?.scrollIntoView({ block: 'nearest' });
  }, [resolved.outputRange]);

  if (!parsed) return null;

  const slice = text.slice(0, MAX_VISIBLE);
  const hi = clampRange(resolved.outputRange, slice.length);
  const backref = clampRange(resolved.backrefRange, slice.length);
  const segments = buildSegments(slice.length, hi, backref);

  const onByteClick = (pos: number) => {
    if (parsed) setSelection(findSelectionAtOutputByte(parsed, pos));
  };

  return (
    <div className="output-text" ref={containerRef}>
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
      {backref && (
        <div style={{ marginTop: 12, fontSize: 11, color: '#9aa3b2' }}>
          back-ref source @ bytes {backref.start.toLocaleString()}–{backref.end.toLocaleString()}
          {' '}· destination @ bytes {hi?.start.toLocaleString()}–{hi?.end.toLocaleString()}
        </div>
      )}
      {text.length > MAX_VISIBLE && (
        <div style={{ marginTop: 12, color: '#6c7388', fontSize: 11 }}>
          … {(text.length - MAX_VISIBLE).toLocaleString()} more characters truncated.
        </div>
      )}
    </div>
  );
}

function clampRange(r: Range | null | undefined, len: number): Range | null {
  if (!r) return null;
  const start = Math.max(0, Math.min(r.start, len));
  const end = Math.max(start, Math.min(r.end, len));
  return start === end ? null : { start, end };
}

// Split [0, len) into contiguous segments at the boundaries of hi and backref,
// assigning each segment either 'hi', 'backref', or '' (plain).
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
