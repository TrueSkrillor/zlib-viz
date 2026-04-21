import { FixedSizeList } from 'react-window';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { buildTreeRows, type TreeRow } from './build-tree';
import { resolveSelection } from '../../state/resolve-selection';
import { useMeasure } from '../common/use-measure';

const ROW_HEIGHT = 20;

export function TreeTab() {
  const parsed = useUiStore(s => s.parsed);
  const depth = useUiStore(s => s.depth);
  const selection = useUiStore(s => s.selection);
  const setSelection = useUiStore(s => s.setSelection);
  const setHover = useUiStore(s => s.setHover);
  const rows: TreeRow[] = useMemo(() => (parsed ? buildTreeRows(parsed, depth) : []), [parsed, depth]);

  const selectedIdx = useMemo(() => {
    return rows.findIndex(r => selectionEquals(r.selection, selection));
  }, [rows, selection]);

  const [hostRef, { width, height }] = useMeasure<HTMLDivElement>();
  const listRef = useRef<FixedSizeList>(null);
  useEffect(() => {
    if (selectedIdx >= 0) listRef.current?.scrollToItem(selectedIdx, 'smart');
  }, [selectedIdx]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const r = rows[index];
    const onHover = () => {
      const range = parsed ? resolveSelection(r.selection, parsed).bitRange : null;
      setHover(range);
    };
    return (
      <div
        className={`tree-row ${index === selectedIdx ? 'active' : ''}`}
        style={{ ...style, paddingLeft: 8 + r.depth * 14 }}
        onClick={() => setSelection(r.selection)}
        onMouseEnter={onHover}
        onMouseLeave={() => setHover(null)}
      >
        <span className="caret">{r.expandable ? '▸' : '·'}</span>
        <span className="name">{r.label}</span>
        {r.detail && <span className="detail">{r.detail}</span>}
        {r.rangeText && <span className="range">{r.rangeText}</span>}
      </div>
    );
  }, [rows, selectedIdx, parsed, setSelection, setHover]);

  if (!parsed) return null;
  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      {width > 0 && height > 0 && (
        <FixedSizeList ref={listRef} height={height} width={width} itemSize={ROW_HEIGHT} itemCount={rows.length}>
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}

function selectionEquals(a: TreeRow['selection'], b: TreeRow['selection']): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'none' || a.kind === 'wrapper' || a.kind === 'trailer') return true;
  if (a.kind === 'block' && b.kind === 'block') return a.blockIndex === b.blockIndex;
  if (a.kind === 'symbol' && b.kind === 'symbol') return a.blockIndex === b.blockIndex && a.symbolIndex === b.symbolIndex;
  if (a.kind === 'blockField' && b.kind === 'blockField')
    return a.blockIndex === b.blockIndex && JSON.stringify(a.fieldPath) === JSON.stringify(b.fieldPath);
  return false;
}
