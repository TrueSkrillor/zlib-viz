import { FixedSizeList } from 'react-window';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { useMeasure } from '../common/use-measure';

const ROW_HEIGHT = 18;

export function TokensTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const setSelection = useUiStore(s => s.setSelection);
  const listRef = useRef<FixedSizeList>(null);

  const [hostRef, { width, height }] = useMeasure<HTMLDivElement>();
  const blockIndex = selection.kind === 'block' || selection.kind === 'blockField' || selection.kind === 'symbol'
    ? selection.blockIndex : 0;
  const block = parsed?.blocks[blockIndex ?? 0];
  const symbols = useMemo(() => (block?.body.kind === 'huffman' ? block.body.symbols : []), [block]);

  useEffect(() => {
    if (selection.kind === 'symbol' && selection.blockIndex === blockIndex) {
      listRef.current?.scrollToItem(selection.symbolIndex, 'smart');
    }
  }, [selection, blockIndex]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const s = symbols[index];
    const isSel = selection.kind === 'symbol' && selection.symbolIndex === index && selection.blockIndex === blockIndex;
    const [kind, label, rng] = s.kind === 'literal'
      ? ['literal', `lit ${s.value}${printable(s.value)}`, bitRangeText(s.bitRange)]
      : s.kind === 'match'
        ? ['match', `match len=${s.length} dist=${s.distance}`, bitRangeText({ start: s.lengthCodeRange.start, end: (s.distExtraRange ?? s.distCodeRange).end })]
        : ['literal', 'end-of-block', bitRangeText(s.bitRange)];
    return (
      <div
        className={`tokens-row ${isSel ? 'active' : ''}`}
        style={style}
        onClick={() => setSelection({ kind: 'symbol', blockIndex: blockIndex ?? 0, symbolIndex: index })}
      >
        <span className="i">#{index}</span>
        <span className={`kind ${kind}`}>{kind}</span>
        <span>{label}</span>
        <span className="rng">{rng}</span>
      </div>
    );
  }, [symbols, selection, blockIndex, setSelection]);

  if (!block) return <div style={{ padding: 12, color: '#6c7388' }}>Select a block.</div>;
  if (block.body.kind !== 'huffman') return <div style={{ padding: 12, color: '#6c7388' }}>Stored blocks have no tokens.</div>;

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      {width > 0 && height > 0 && (
        <FixedSizeList ref={listRef} height={height} width={width} itemSize={ROW_HEIGHT} itemCount={symbols.length} style={{ overflowX: 'hidden' }}>
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}

function bitRangeText(r: { start: number; end: number }) { return `${r.start}–${r.end}`; }
function printable(c: number) { return c >= 0x20 && c < 0x7f ? ` '${String.fromCharCode(c)}'` : ''; }
