import { FixedSizeList } from 'react-window';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';
import { findSelectionAtBit } from '../../state/find-at-bit';
import { useMeasure } from '../common/use-measure';

const BITS_PER_ROW = 64;
const ROW_HEIGHT = 18;

export function BitStreamTab({ bytes }: { bytes: Uint8Array }) {
  const selection = useUiStore(s => s.selection);
  const hover = useUiStore(s => s.hover);
  const parsed = useUiStore(s => s.parsed);
  const setSelection = useUiStore(s => s.setSelection);
  const selRange = useMemo(() => resolveSelection(selection, parsed).bitRange, [selection, parsed]);
  const hiRange = hover ?? selRange;

  const [hostRef, { width, height }] = useMeasure<HTMLDivElement>();
  const listRef = useRef<FixedSizeList>(null);
  useEffect(() => {
    if (!selRange) return;
    listRef.current?.scrollToItem(Math.floor(selRange.start / BITS_PER_ROW), 'smart');
  }, [selRange]);

  const totalBits = bytes.length * 8;
  const rowCount = Math.max(1, Math.ceil(totalBits / BITS_PER_ROW));

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const start = index * BITS_PER_ROW;
    const end = Math.min(start + BITS_PER_ROW, totalBits);
    const parts: React.ReactNode[] = [];
    for (let i = start; i < end; i++) {
      const byte = bytes[i >> 3];
      const bit = (byte >> (i & 7)) & 1;
      const inSel = selRange ? i >= selRange.start && i < selRange.end : false;
      const inHover = hiRange ? i >= hiRange.start && i < hiRange.end : false;
      const cls = inSel ? 'hi sel' : inHover ? 'hi' : '';
      parts.push(
        <span
          key={i}
          className={cls}
          onClick={() => parsed && setSelection(findSelectionAtBit(parsed, i))}
        >
          {bit}
        </span>,
      );
      if (i - start > 0 && ((i - start + 1) % 8 === 0)) parts.push(' ');
    }
    return (
      <div className="bits-row" style={style}>
        <span className="off">bit {start.toLocaleString()}</span>
        <span className="bts">{parts}</span>
      </div>
    );
  }, [bytes, totalBits, selRange, hiRange, setSelection, parsed]);

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      {width > 0 && height > 0 && (
        <FixedSizeList ref={listRef} height={height} width={width} itemSize={ROW_HEIGHT} itemCount={rowCount} style={{ overflowX: 'hidden' }}>
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}
