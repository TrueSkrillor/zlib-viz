import { useCallback, useRef, useState } from 'react';
import { parseInWorker } from '../../worker/client';
import { useUiStore } from '../../state/selection';
import { HexPasteModal } from './HexPasteModal';
import { ExampleLibrary } from './ExampleLibrary';

export function InputArea() {
  const setParsed = useUiStore(s => s.setParsed);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'parsing' | 'error'; message?: string }>({ kind: 'idle' });
  const [showModal, setShowModal] = useState(false);

  const onBytes = useCallback(async (bytes: Uint8Array) => {
    setStatus({ kind: 'parsing' });
    try {
      const kept = new Uint8Array(bytes);          // keep a copy for the store
      const parsed = await parseInWorker(bytes);   // transfers the original buffer
      setParsed(parsed, kept);
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [setParsed]);

  const onFile = useCallback(async (file: File) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    await onBytes(buf);
  }, [onBytes]);

  const onExample = useCallback(async (path: string) => {
    setStatus({ kind: 'parsing' });
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`failed to fetch ${path}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      await onBytes(buf);
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [onBytes]);

  return (
    <div className="input-area">
      <div
        className={`input-card ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void onFile(file);
        }}
      >
        <h1>zlib-viz</h1>
        <p>Drop a zlib / gzip / raw-DEFLATE file here, or pick one.</p>
        <div className="actions">
          <button onClick={() => fileRef.current?.click()}>Choose file</button>
          <button className="secondary" onClick={() => setShowModal(true)}>Paste bytes</button>
        </div>
        <input
          ref={fileRef} type="file" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
        <ExampleLibrary onChoose={onExample} />
        {status.kind === 'parsing' && <div className="progress">Parsing…</div>}
        {status.kind === 'error' && <div className="error-banner">{status.message}</div>}
        {showModal && (
          <HexPasteModal
            onClose={() => setShowModal(false)}
            onBytes={(b) => { setShowModal(false); void onBytes(b); }}
          />
        )}
      </div>
    </div>
  );
}
