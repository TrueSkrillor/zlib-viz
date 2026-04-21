import { useUiStore } from '../../state/selection';
import { Tabs } from '../common/Tabs';

export function OutputPane() {
  const tab = useUiStore(s => s.outputPaneTab);
  const setTab = useUiStore(s => s.setOutputPaneTab);
  return (
    <div className="pane">
      <div className="pane-header">Decoded output</div>
      <Tabs
        tabs={[
          { id: 'text', label: 'Text' },
          { id: 'hex', label: 'Hex' },
          { id: 'tokens', label: 'Tokens' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="pane-body">(output pane — filled in next tasks)</div>
    </div>
  );
}
