import { useUiStore } from '../../state/selection';

export function Viewer() {
  const reset = useUiStore(s => s.setParsed);
  const parsed = useUiStore(s => s.parsed);
  if (!parsed) return null;
  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => reset(null)}>← Back</button>
      <p>Parsed: {parsed.format}, {parsed.blocks.length} block(s), decoded {parsed.decoded.length} bytes.</p>
    </div>
  );
}
