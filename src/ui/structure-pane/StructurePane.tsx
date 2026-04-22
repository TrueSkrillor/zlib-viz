import { useUiStore } from '../../state/selection';
import { Tabs } from '../common/Tabs';
import { BitLayoutTab } from './BitLayoutTab';
import { CodeLenAlphabetTab } from './CodeLenAlphabetTab';
import { HuffmanTreesTab } from './HuffmanTreesTab';
import { TreeTab } from './TreeTab';

export function StructurePane() {
  const tab = useUiStore(s => s.structurePaneTab);
  const setTab = useUiStore(s => s.setStructurePaneTab);

  return (
    <div className="pane">
      <div className="pane-header">Structure</div>
      <Tabs
        tabs={[
          { id: 'tree', label: 'Tree' },
          { id: 'bit-layout', label: 'Bit layout' },
          { id: 'huffman', label: 'Huffman trees' },
          { id: 'code-len', label: 'Code-len alphabet' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="pane-body" style={{ padding: 0 }}>
        {tab === 'tree' && <TreeTab />}
        {tab === 'bit-layout' && <BitLayoutTab />}
        {tab === 'huffman' && <HuffmanTreesTab />}
        {tab === 'code-len' && <CodeLenAlphabetTab />}
      </div>
    </div>
  );
}
