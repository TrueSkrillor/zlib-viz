import { BytesPane } from '../bytes-pane/BytesPane';
import { StructurePane } from '../structure-pane/StructurePane';
import { OutputPane } from '../output-pane/OutputPane';

export function ThreePane() {
  return (
    <div className="three-pane">
      <BytesPane />
      <StructurePane />
      <OutputPane />
    </div>
  );
}
