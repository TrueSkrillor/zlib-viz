import { useUiStore } from '../../state/selection';

type Seg = { label: string; bits: number; className: string };

export function BitLayoutTab() {
  const parsed = useUiStore(s => s.parsed);
  const selection = useUiStore(s => s.selection);
  const setHover = useUiStore(s => s.setHover);
  const blockIndex = selection.kind === 'block' || selection.kind === 'blockField' || selection.kind === 'symbol'
    ? selection.blockIndex : 0;
  if (!parsed) return null;
  const block = parsed.blocks[blockIndex ?? 0];
  if (!block) return <div style={{ padding: 12, color: '#6c7388' }}>Select a block.</div>;

  const segs: Seg[] = [{ label: `header ${block.btype}`, bits: 3, className: 'header' }];
  if (block.body.kind === 'huffman' && block.body.dynamicMeta) {
    const m = block.body.dynamicMeta;
    segs.push({ label: `HLIT=${m.hlit}`, bits: 5, className: 'meta' });
    segs.push({ label: `HDIST=${m.hdist}`, bits: 5, className: 'meta' });
    segs.push({ label: `HCLEN=${m.hclen}`, bits: 4, className: 'meta' });
    segs.push({ label: `code-len lengths (${m.codeLenCodeLengths.length}×3)`,
      bits: m.codeLenCodeLengths.length * 3, className: 'clen' });
    const litBits = m.litlenLengths.reduce((n, e) => n + (e.codeRange.end - e.codeRange.start) + (e.extraRange ? (e.extraRange.end - e.extraRange.start) : 0), 0);
    segs.push({ label: `lit/len lengths (RLE)`, bits: litBits, className: 'lit' });
    const distBits = m.distLengths.reduce((n, e) => n + (e.codeRange.end - e.codeRange.start) + (e.extraRange ? (e.extraRange.end - e.extraRange.start) : 0), 0);
    segs.push({ label: `dist lengths (RLE)`, bits: distBits, className: 'dist' });
  }
  const headerBits = segs.reduce((n, s) => n + s.bits, 0);
  segs.push({ label: 'compressed symbols', bits: (block.range.end - block.range.start) - headerBits, className: 'data' });

  const minPx = 8;
  return (
    <div className="bit-layout">
      <div className="bit-layout-row">
        {segs.map((s, i) => (
          <div
            key={i}
            className={`seg ${s.className}`}
            style={{ width: Math.max(minPx, s.bits) }}
            title={`${s.label} · ${s.bits} bit(s)`}
            onMouseEnter={() => setHover(rangeFor(block, s, i, segs))}
            onMouseLeave={() => setHover(null)}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function rangeFor(block: { range: { start: number } }, _seg: Seg, idx: number, segs: Seg[]) {
  let start = block.range.start;
  for (let i = 0; i < idx; i++) start += segs[i].bits;
  return { start, end: start + segs[idx].bits };
}
