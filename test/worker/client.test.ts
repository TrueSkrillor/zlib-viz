import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { parseStream } from '../../src/parser';
import type { WorkerResponse } from '../../src/worker/parse-worker';

describe('worker protocol shape', () => {
  it('parseStream output is assignable to WorkerResponse done.parsed', () => {
    const bytes = new Uint8Array(deflateSync(Buffer.from('check')));
    const parsed = parseStream(bytes);
    const msg: WorkerResponse = { type: 'done', parsed };
    expect(msg.type).toBe('done');
    expect(msg.parsed.blocks.length).toBeGreaterThan(0);
  });
});
