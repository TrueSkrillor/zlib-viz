import { TopBar } from './TopBar';
import { BlockTimeline } from './BlockTimeline';
import { ThreePane } from './ThreePane';

export function Viewer() {
  return (
    <div className="viewer">
      <TopBar />
      <BlockTimeline />
      <ThreePane />
    </div>
  );
}
