import { useUiStore } from '../../state/selection';
import { Tabs } from '../common/Tabs';

export function BytesPane() {
  const tab = useUiStore(s => s.bytesPaneTab);
  const setTab = useUiStore(s => s.setBytesPaneTab);
  return (
    <div className="pane">
      <div className="pane-header">Bytes · Bits</div>
      <Tabs
        tabs={[{ id: 'hex', label: 'Hex' }, { id: 'bits', label: 'Bit stream' }]}
        value={tab}
        onChange={setTab}
      />
      <div className="pane-body">(bytes pane — filled in next task)</div>
    </div>
  );
}
