import { useUiStore } from '../../state/selection';
import { DepthSelector } from './DepthSelector';

export function TopBar() {
  const parsed = useUiStore(s => s.parsed);
  const reset = useUiStore(s => s.setParsed);
  if (!parsed) return null;
  return (
    <div className="topbar">
      <button onClick={() => reset(null)}>←</button>
      <span className="pill detect">auto: {parsed.format}</span>
      <span className="pill">{parsed.totalBytes.toLocaleString()} bytes</span>
      <span className="pill">{parsed.blocks.length} blocks</span>
      <span className="pill">decoded {parsed.decoded.length.toLocaleString()} bytes</span>
      {parsed.errors.length > 0 && <span className="pill" style={{ background: '#7f1d1d' }}>{parsed.errors.length} issue(s)</span>}
      <div className="spacer" />
      <DepthSelector />
    </div>
  );
}
