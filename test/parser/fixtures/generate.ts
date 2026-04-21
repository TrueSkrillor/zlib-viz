import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  constants as zlibConsts, deflateRawSync, deflateSync, gzipSync,
} from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(here, { recursive: true });

const write = (name: string, bytes: Buffer) => writeFileSync(resolve(here, name), bytes);

const hello = Buffer.from('Hello, world! '.repeat(20));
const lorem = Buffer.from('Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50));

write('empty.zlib', deflateSync(Buffer.alloc(0)));
write('fixed-huffman.zlib', deflateSync(hello, { strategy: zlibConsts.Z_FIXED }));
write('dynamic-small.zlib', deflateSync(hello));
write('dynamic-large.zlib', deflateSync(lorem, { level: 9 }));
write('gzip-plain.gz', gzipSync(hello));
write('raw-deflate.bin', deflateRawSync(hello));
write('multi-block.zlib', deflateSync(Buffer.concat([hello, lorem, hello]), { level: 6 }));
write('stored-only.zlib', deflateSync(hello, { level: 0 }));

const bad = Buffer.from(deflateSync(hello));
bad[bad.length - 1] ^= 0xff;
write('bad-adler.zlib', bad);

const truncated = Buffer.from(deflateSync(hello));
write('truncated.zlib', truncated.subarray(0, truncated.length - 6));

const badGzip = Buffer.from(gzipSync(hello));
badGzip[badGzip.length - 5] ^= 0xff;
write('bad-crc.gz', badGzip);

console.log('Fixtures written to', here);
