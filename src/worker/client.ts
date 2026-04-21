import type { ParsedStream } from '../parser/types';
import type { WorkerRequest, WorkerResponse } from './parse-worker';

export type ParseCallbacks = {
  onProgress?: (p: { blocksDone: number; bytesConsumed: number }) => void;
};

export function parseInWorker(bytes: Uint8Array, cb: ParseCallbacks = {}): Promise<ParsedStream> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parse-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data;
      if (m.type === 'progress') { cb.onProgress?.(m); return; }
      if (m.type === 'done') { resolve(m.parsed); worker.terminate(); return; }
      if (m.type === 'error') {
        reject(Object.assign(new Error(m.message), { partialParsed: m.partialParsed }));
        worker.terminate();
      }
    };
    worker.onerror = (e) => { reject(new Error(e.message)); worker.terminate(); };
    const req: WorkerRequest = { type: 'parse', bytes };
    worker.postMessage(req, [bytes.buffer]);
  });
}
