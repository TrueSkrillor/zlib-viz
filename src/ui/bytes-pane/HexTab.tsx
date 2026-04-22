import { FixedSizeList } from 'react-window';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';
import { findSelectionAtBit } from '../../state/find-at-bit';
import { useMeasure } from '../common/use-measure';

const ROW_HEIGHT = 18;
const WIDE_THRESHOLD = 540; // px — below this we show 8 bytes/row instead of 16

function rowBytesFor(width: number): number {
  return width >= WIDE_THRESHOLD ? 16 : 8;
}

export function HexTab({ bytes }: { bytes: Uint8Array }) {
  const selection = useUiStore(s => s.selection);
  const hover = useUiStore(s => s.hover);
  const parsed = useUiStore(s => s.parsed);
  const setSelection = useUiStore(s => s.setSelection);
  const selRange = useMemo(() => resolveSelection(selection, parsed).bitRange, [selection, parsed]);
  const hiRange = hover ?? selRange;

  const [hostRef, { width, height }] = useMeasure<HTMLDivElement>();
  const rowBytes = rowBytesFor(width);
  const listRef = useRef<FixedSizeList>(null);

  useEffect(() => {
    if (!selRange) return;
    const byteStart = selRange.start >> 3;
    const row = Math.floor(byteStart / rowBytes);
    listRef.current?.scrollToItem(row, 'smart');
  }, [selRange, rowBytes]);

  const rowCount = Math.max(1, Math.ceil(bytes.length / rowBytes));

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const off = index * rowBytes;
    const end = Math.min(off + rowBytes, bytes.length);
    const hexParts: React.ReactNode[] = [];
    const asciiParts: React.ReactNode[] = [];
    for (let i = off; i < end; i++) {
      const inSel = selRange ? i * 8 < selRange.end && (i + 1) * 8 > selRange.start : false;
      const inHover = hiRange ? i * 8 < hiRange.end && (i + 1) * 8 > hiRange.start : false;
      const cls = inSel ? 'hi sel' : inHover ? 'hi' : '';
      const onByteClick = () => parsed && setSelection(findSelectionAtBit(parsed, i * 8));
      hexParts.push(
        <span key={i} className={cls} onClick={onByteClick}>
          {bytes[i].toString(16).padStart(2, '0')}{i < end - 1 ? ' ' : ''}
        </span>,
      );
      const c = bytes[i];
      const glyph = c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '·';
      asciiParts.push(
        <span key={i} className={cls} onClick={onByteClick}>{glyph}</span>,
      );
    }
    return (
      <div className="hex-row" style={style}>
        <span className="off">{off.toString(16).padStart(6, '0')}</span>
        <span className="hx">{hexParts}</span>
        <span className="ascii">{asciiParts}</span>
      </div>
    );
  }, [bytes, selRange, hiRange, setSelection, parsed, rowBytes]);

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      {width > 0 && height > 0 && (
        <FixedSizeList
          ref={listRef}
          height={height}
          width={width}
          itemSize={ROW_HEIGHT}
          itemCount={rowCount}
          style={{ overflowX: 'hidden' }}
        >
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}
