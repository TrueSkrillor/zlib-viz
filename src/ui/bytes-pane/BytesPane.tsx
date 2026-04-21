import { useUiStore } from '../../state/selection';
import { Tabs } from '../common/Tabs';
import { HexTab } from './HexTab';
import { BitStreamTab } from './BitStreamTab';

export function BytesPane() {
  const tab = useUiStore(s => s.bytesPaneTab);
  const setTab = useUiStore(s => s.setBytesPaneTab);
  const bytes = useUiStore(s => s.inputBytes);
  return (
    <div className="pane">
      <div className="pane-header">Bytes · Bits</div>
      <Tabs
        tabs={[{ id: 'hex', label: 'Hex' }, { id: 'bits', label: 'Bit stream' }]}
        value={tab}
        onChange={setTab}
      />
      <div className="pane-body" style={{ padding: 0 }}>
        {bytes && tab === 'hex' && <HexTab bytes={bytes} />}
        {bytes && tab === 'bits' && <BitStreamTab bytes={bytes} />}
      </div>
    </div>
  );
}
