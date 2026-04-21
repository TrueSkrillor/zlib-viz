import { FixedSizeList } from 'react-window';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUiStore } from '../../state/selection';
import { resolveSelection } from '../../state/resolve-selection';

const ROW_BYTES = 16;
const ROW_HEIGHT = 18;

export function OutputHexTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const resolved = useMemo(() => resolveSelection(selection, parsed), [selection, parsed]);
  const listRef = useRef<FixedSizeList>(null);

  useEffect(() => {
    if (!resolved.outputRange) return;
    listRef.current?.scrollToItem(Math.floor(resolved.outputRange.start / ROW_BYTES), 'smart');
  }, [resolved.outputRange]);

  if (!parsed) return null;
  const decoded = parsed.decoded;
  const rowCount = Math.max(1, Math.ceil(decoded.length / ROW_BYTES));

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const off = index * ROW_BYTES;
    const end = Math.min(off + ROW_BYTES, decoded.length);
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
        <span className="off">0x{off.toString(16).padStart(6, '0')}</span>
        <span className="hx">{parts}</span>
        <span className="ascii">{asciiChars.join('')}</span>
      </div>
    );
  }, [decoded, resolved]);

  return (
    <FixedSizeList ref={listRef} height={400} width="100%" itemSize={ROW_HEIGHT} itemCount={rowCount}>
      {Row}
    </FixedSizeList>
  );
}
