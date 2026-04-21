import { useUiStore } from '../../state/selection';
import { Tabs } from '../common/Tabs';

export function StructurePane() {
  const tab = useUiStore(s => s.structurePaneTab);
  const setTab = useUiStore(s => s.setStructurePaneTab);
  const depth = useUiStore(s => s.depth);
  return (
    <div className="pane">
      <div className="pane-header">Structure</div>
      <Tabs
        tabs={[
          { id: 'tree', label: 'Tree' },
          { id: 'bit-layout', label: 'Bit layout', disabled: depth < 3 },
          { id: 'huffman', label: 'Huffman trees', disabled: depth < 2 },
          { id: 'code-len', label: 'Code-len alphabet', disabled: depth < 3 },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="pane-body">(structure pane — filled in next tasks)</div>
    </div>
  );
}
