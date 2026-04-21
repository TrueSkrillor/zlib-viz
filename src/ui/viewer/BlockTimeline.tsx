import { useUiStore } from '../../state/selection';

const BLOCK_CLASS = { stored: 'stored', fixed: 'fixed', dynamic: 'dynamic' } as const;

export function BlockTimeline() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const setSelection = useUiStore(s => s.setSelection);
  if (!parsed) return null;

  const total = parsed.blocks.reduce((n, b) => n + (b.range.end - b.range.start), 0);
  const selectedBlock = selection.kind === 'block' || selection.kind === 'blockField' || selection.kind === 'symbol'
    ? selection.blockIndex
    : -1;

  return (
    <div className="timeline">
      {parsed.wrapper && (
        <div
          className={`seg wrap ${selection.kind === 'wrapper' ? 'active' : ''}`}
          style={{ width: 28 }}
          title={`${parsed.wrapper.kind} wrapper`}
          onClick={() => setSelection({ kind: 'wrapper' })}
        >W</div>
      )}
      {parsed.blocks.map(b => {
        const w = Math.max(4, ((b.range.end - b.range.start) / total) * 100);
        return (
          <div
            key={b.index}
            className={`seg ${BLOCK_CLASS[b.btype]} ${selectedBlock === b.index ? 'active' : ''}`}
            style={{ flex: `${w} 0 0` }}
            title={`Block ${b.index} · ${b.btype} · ${(b.range.end - b.range.start) >> 3} bytes`}
            onClick={() => setSelection({ kind: 'block', blockIndex: b.index })}
          >
            {b.index} · {b.btype}
          </div>
        );
      })}
      {parsed.trailer && (
        <div
          className={`seg trailer ${selection.kind === 'trailer' ? 'active' : ''}`}
          style={{ width: 28 }}
          title={`${parsed.trailer.kind} trailer`}
          onClick={() => setSelection({ kind: 'trailer' })}
        >T</div>
      )}
    </div>
  );
}
