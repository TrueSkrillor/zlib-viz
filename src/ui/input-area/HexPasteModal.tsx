import { useState } from 'react';

type Mode = 'hex' | 'base64';

export function HexPasteModal({ onBytes, onClose }: { onBytes: (b: Uint8Array) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('hex');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    try {
      const bytes = mode === 'hex' ? parseHex(text) : parseBase64(text);
      if (bytes.length === 0) throw new Error('empty input');
      onBytes(bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Paste bytes</h3>
        <div className="radio">
          <label><input type="radio" checked={mode === 'hex'} onChange={() => setMode('hex')} /> Hex</label>
          <label><input type="radio" checked={mode === 'base64'} onChange={() => setMode('base64')} /> Base64</label>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === 'hex' ? '78 9C ED … or 789ced…' : 'eNp…'}
        />
        <div className="hint">
          Hex mode: any whitespace, `0x` prefixes, or `,` separators are ignored.
        </div>
        {error && <div style={{ color: '#fca5a5' }}>{error}</div>}
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={submit}>Parse</button>
        </div>
      </div>
    </div>
  );
}

function parseHex(s: string): Uint8Array {
  const cleaned = s.replace(/0x/gi, '').replace(/[\s,;]/g, '');
  if (cleaned.length === 0) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error('hex contains non-hex characters');
  if (cleaned.length % 2 !== 0) throw new Error('hex length must be even');
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(cleaned.substr(i * 2, 2), 16);
  return out;
}

function parseBase64(s: string): Uint8Array {
  const cleaned = s.replace(/\s/g, '');
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
