import { FixedSizeList } from 'react-window';
import { useUiStore } from '../../state/selection';
import type { HuffmanTable } from '../../parser/types';

const ROW_HEIGHT = 16;

export function HuffmanTreesTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const blockIndex = selection.kind === 'block' || selection.kind === 'blockField' || selection.kind === 'symbol' ? selection.blockIndex : 0;
  if (!parsed) return null;
  const b = parsed.blocks[blockIndex ?? 0];
  if (!b || b.body.kind !== 'huffman') return <div style={{ padding: 12, color: '#6c7388' }}>Select a Huffman block.</div>;

  const sections: Array<{ title: string; table: HuffmanTable }> = [
    { title: 'lit/len alphabet', table: b.body.litlenTable },
    { title: 'distance alphabet', table: b.body.distTable },
  ];
  if (b.body.dynamicMeta) sections.push({ title: 'code-length alphabet', table: b.body.dynamicMeta.codeLenTable });

  return (
    <div className="huffman-sections">
      {sections.map(({ title, table }) => (
        <div className="card" key={title}>
          <h4>{title} · {table.symbolsByCode.length} symbols · max {table.maxBits} bits</h4>
          <div style={{ flex: 1, minHeight: 0 }}>
            <HuffmanList table={table} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HuffmanList({ table }: { table: HuffmanTable }) {
  const rows = table.symbolsByCode;
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const r = rows[index];
    const codeStr = r.code.toString(2).padStart(r.bits, '0');
    const label = symbolLabel(r.symbol);
    return (
      <div className="huffman-row" style={style}>
        <span className="bits">{r.bits}b</span>
        <span className="code">{codeStr}</span>
        <span className="sym">{label}</span>
      </div>
    );
  };
  return (
    <FixedSizeList height={280} width="100%" itemSize={ROW_HEIGHT} itemCount={rows.length}>
      {Row}
    </FixedSizeList>
  );
}

function symbolLabel(s: number): string {
  if (s < 256) return `literal ${s}${printable(s)}`;
  if (s === 256) return 'end-of-block';
  if (s <= 285) return `length code ${s}`;
  return `symbol ${s}`;
}
function printable(c: number): string { return c >= 0x20 && c < 0x7f ? ` '${String.fromCharCode(c)}'` : ''; }
