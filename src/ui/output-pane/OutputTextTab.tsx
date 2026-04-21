import { useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';

const MAX_VISIBLE = 50_000;

export function OutputTextTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  if (!parsed) return null;

  const text = useMemo(() => {
    try { return new TextDecoder('utf-8', { fatal: false }).decode(parsed.decoded); }
    catch { return ''; }
  }, [parsed.decoded]);

  const resolved = useMemo(() => resolveSelection(selection, parsed), [selection, parsed]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resolved.outputRange || !containerRef.current) return;
    const sel = containerRef.current.querySelector<HTMLElement>('.span.hi');
    sel?.scrollIntoView({ block: 'nearest' });
  }, [resolved.outputRange]);

  const slice = text.slice(0, MAX_VISIBLE);
  const highlight = resolved.outputRange ?? null;
  const backref = resolved.backrefRange ?? null;

  return (
    <div className="output-text" ref={containerRef}>
      {highlight
        ? <>
            <span>{slice.slice(0, highlight.start)}</span>
            <span className="span hi">{slice.slice(highlight.start, highlight.end)}</span>
            <span>{slice.slice(highlight.end)}</span>
          </>
        : <span>{slice}</span>}
      {backref && (
        <div style={{ marginTop: 12, fontSize: 11, color: '#9aa3b2' }}>
          back-ref source @ bytes {backref.start.toLocaleString()}–{backref.end.toLocaleString()}:{' '}
          <span className="span" style={{ background: 'rgba(244,114,182,0.2)', padding: '0 2px' }}>
            {slice.slice(backref.start, backref.end)}
          </span>
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
