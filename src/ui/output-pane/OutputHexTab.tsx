import { FixedSizeList } from 'react-window';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';
import { useMeasure } from '../common/use-measure';

const ROW_HEIGHT = 18;
const WIDE_THRESHOLD = 540;

function rowBytesFor(width: number): number {
  return width >= WIDE_THRESHOLD ? 16 : 8;
}

export function OutputHexTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const resolved = useMemo(() => resolveSelection(selection, parsed), [selection, parsed]);
  const [hostRef, { width, height }] = useMeasure<HTMLDivElement>();
  const rowBytes = rowBytesFor(width);
  const listRef = useRef<FixedSizeList>(null);

  useEffect(() => {
    if (!resolved.outputRange) return;
    listRef.current?.scrollToItem(Math.floor(resolved.outputRange.start / rowBytes), 'smart');
  }, [resolved.outputRange, rowBytes]);

  const decoded = parsed?.decoded ?? new Uint8Array(0);
  const rowCount = Math.max(1, Math.ceil(decoded.length / rowBytes));

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const off = index * rowBytes;
    const end = Math.min(off + rowBytes, decoded.length);
    const parts: React.ReactNode[] = [];
    const asciiChars: string[] = [];
    for (let i = off; i < end; i++) {
      const inSel = resolved.outputRange ? i >= resolved.outputRange.start && i < resolved.outputRange.end : false;
      const inBackref = resolved.backrefRange ? i >= resolved.backrefRange.start && i < resolved.backrefRange.end : false;
      const cls = inSel ? 'hi sel' : inBackref ? 'hi' : '';
      parts.push(<span key={i} className={cls}>{decoded[i].toString(16).padStart(2, '0')}{i < end - 1 ? ' ' : ''}</span>);
      const c = decoded[i];
      asciiChars.push(c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '·');
    }
    return (
      <div className="output-hex-row" style={style}>
        <span className="off">{off.toString(16).padStart(6, '0')}</span>
        <span className="hx">{parts}</span>
        <span className="ascii">{asciiChars.join('')}</span>
      </div>
    );
  }, [decoded, resolved, rowBytes]);

  if (!parsed) return null;
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
