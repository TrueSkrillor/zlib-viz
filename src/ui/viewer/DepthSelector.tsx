import { useUiStore, type Depth } from '../../state/selection';

const OPTIONS: { value: Depth; label: string }[] = [
  { value: 1, label: 'L1' },
  { value: 2, label: 'L2' },
  { value: 3, label: 'L3' },
];

export function DepthSelector() {
  const depth = useUiStore(s => s.depth);
  const setDepth = useUiStore(s => s.setDepth);
  return (
    <div className="depth-selector">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          className={o.value === depth ? 'active' : ''}
          onClick={() => setDepth(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
