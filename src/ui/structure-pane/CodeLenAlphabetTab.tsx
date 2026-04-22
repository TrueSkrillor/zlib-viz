import { FixedSizeList } from 'react-window';
import type { ReactNode } from 'react';
import { useUiStore } from '../../state/selection';
import { CODE_LEN_ORDER } from '../../parser/constants';
import { useMeasure } from '../common/use-measure';

const ROW_HEIGHT = 16;

export function CodeLenAlphabetTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const setHover = useUiStore(s => s.setHover);
  const blockIndex = selection.kind === 'block' || selection.kind === 'blockField' || selection.kind === 'symbol' ? selection.blockIndex : 0;
  if (!parsed) return null;
  const b = parsed.blocks[blockIndex ?? 0];
  if (!b || b.body.kind !== 'huffman' || !b.body.dynamicMeta) {
    return <div style={{ padding: 12, color: '#6c7388' }}>Only dynamic Huffman blocks have a code-length alphabet.</div>;
  }
  const m = b.body.dynamicMeta;

  const Code = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = m.codeLenCodeLengths[index];
    const alphabetSymbol = CODE_LEN_ORDER[index];
    if (!entry) return <div style={style} />;
    return (
      <div
        className="code-len-row"
        style={style}
        onMouseEnter={() => setHover(entry.range)}
        onMouseLeave={() => setHover(null)}
      >
        <span className="i">#{index}</span>
        <span className="sym">{alphabetSymbol}</span>
        <span>len={entry.value}</span>
        <span className="rng">{entry.range.start}–{entry.range.end}</span>
      </div>
    );
  };

  const allRle = [...m.litlenLengths, ...m.distLengths];
  const Rle = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const e = allRle[index];
    return (
      <div
        className="rle-row"
        style={style}
        onMouseEnter={() => {
          const start = e.codeRange.start;
          const end = (e.extraRange ?? e.codeRange).end;
          setHover({ start, end });
        }}
        onMouseLeave={() => setHover(null)}
      >
        <span>{e.kind}</span>
        <span>value {e.value}</span>
        <span>@{e.expandedIndex}</span>
        <span>{e.expandedLengths.slice(0, 8).join(',')}{e.expandedLengths.length > 8 ? '…' : ''}</span>
      </div>
    );
  };

  return (
    <div className="code-len-grid">
      <Section title={`Code-length lengths (${m.codeLenCodeLengths.length}×3 bits)`}>
        {(w, h) => (
          <FixedSizeList height={h} width={w} itemSize={ROW_HEIGHT} itemCount={m.codeLenCodeLengths.length} style={{ overflowX: 'hidden' }}>
            {Code}
          </FixedSizeList>
        )}
      </Section>
      <Section title={`RLE expansion (${allRle.length} entries)`}>
        {(w, h) => (
          <FixedSizeList height={h} width={w} itemSize={ROW_HEIGHT} itemCount={allRle.length} style={{ overflowX: 'hidden' }}>
            {Rle}
          </FixedSizeList>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: (w: number, h: number) => ReactNode }) {
  const [ref, { width, height }] = useMeasure<HTMLDivElement>();
  return (
    <div className="code-len-section">
      <h4>{title}</h4>
      <div ref={ref} style={{ flex: 1, minHeight: 0 }}>
        {width > 0 && height > 0 && children(width, height)}
      </div>
    </div>
  );
}
