import { InputArea } from './input-area/InputArea';
import { Viewer } from './viewer/Viewer';
import { useUiStore } from '../state/selection';

export function App() {
  const parsed = useUiStore(s => s.parsed);
  return <div className="app-root">{parsed ? <Viewer /> : <InputArea />}</div>;
}
