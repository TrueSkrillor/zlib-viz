import { FixedSizeList, type ListOnItemsRenderedProps } from 'react-window';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';
import { findSelectionAtBit } from '../../state/find-at-bit';

const ROW_BYTES = 16;
const ROW_HEIGHT = 18;

export function HexTab({ bytes }: { bytes: Uint8Array }) {
  const selection = useUiStore(s => s.selection);
  const hover = useUiStore(s => s.hover);
  const parsed = useUiStore(s => s.parsed);
  const setSelection = useUiStore(s => s.setSelection);
  const selRange = useMemo(() => resolveSelection(selection, parsed).bitRange, [selection, parsed]);
  const hiRange = hover ?? selRange;

  const listRef = useRef<FixedSizeList>(null);

  useEffect(() => {
    if (!selRange) return;
    const byteStart = selRange.start >> 3;
    const row = Math.floor(byteStart / ROW_BYTES);
    listRef.current?.scrollToItem(row, 'smart');
  }, [selRange]);

  const rowCount = Math.max(1, Math.ceil(bytes.length / ROW_BYTES));

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const off = index * ROW_BYTES;
    const end = Math.min(off + ROW_BYTES, bytes.length);
    const hexParts: React.ReactNode[] = [];
    const asciiChars: string[] = [];
    for (let i = off; i < end; i++) {
      const inSel = selRange ? i * 8 < selRange.end && (i + 1) * 8 > selRange.start : false;
      const inHover = hiRange ? i * 8 < hiRange.end && (i + 1) * 8 > hiRange.start : false;
      const cls = inSel ? 'hi sel' : inHover ? 'hi' : '';
      hexParts.push(
        <span
          key={i}
          className={cls}
          onClick={() => parsed && setSelection(findSelectionAtBit(parsed, i * 8))}
        >
          {bytes[i].toString(16).padStart(2, '0')}{i < end - 1 ? ' ' : ''}
        </span>,
      );
      const c = bytes[i];
      asciiChars.push(c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '·');
    }
    return (
      <div className="hex-row" style={style}>
        <span className="off">0x{off.toString(16).padStart(6, '0')}</span>
        <span className="hx">{hexParts}</span>
        <span className="ascii">{asciiChars.join('')}</span>
      </div>
    );
  }, [bytes, selRange, hiRange, setSelection, parsed]);

  const onItemsRendered = useCallback((_: ListOnItemsRenderedProps) => {}, []);

  return (
    <FixedSizeList
      ref={listRef}
      height={400}
      width="100%"
      itemSize={ROW_HEIGHT}
      itemCount={rowCount}
      onItemsRendered={onItemsRendered}
    >
      {Row}
    </FixedSizeList>
  );
}
