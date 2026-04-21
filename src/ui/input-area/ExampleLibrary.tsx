import { EXAMPLES } from '../../examples';

export function ExampleLibrary({ onChoose }: { onChoose: (path: string) => void }) {
  return (
    <div className="examples">
      <h4>Or try an example</h4>
      <ul>
        {EXAMPLES.map(e => (
          <li key={e.id}>
            <button className="secondary" onClick={() => onChoose(e.path)}>{e.label}</button>
            <span className="hint">{e.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
