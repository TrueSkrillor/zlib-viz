/// <reference lib="webworker" />
import { parseStream } from '../parser';
import type { ParsedStream } from '../parser/types';

export type WorkerRequest = { type: 'parse'; bytes: Uint8Array };

export type WorkerResponse =
  | { type: 'progress'; blocksDone: number; bytesConsumed: number }
  | { type: 'done'; parsed: ParsedStream }
  | { type: 'error'; message: string; partialParsed?: ParsedStream };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type !== 'parse') return;
  try {
    const parsed = parseStream(msg.bytes);
    ctx.postMessage({ type: 'progress', blocksDone: parsed.blocks.length, bytesConsumed: msg.bytes.length } satisfies WorkerResponse);
    ctx.postMessage({ type: 'done', parsed } satisfies WorkerResponse);
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
