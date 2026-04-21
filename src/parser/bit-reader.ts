export class BitReader {
  private readonly bytes: Uint8Array;
  private readonly totalBits: number;
  private pos = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.totalBits = bytes.length * 8;
  }

  get bitPos(): number {
    return this.pos;
  }

  eof(): boolean {
    return this.pos >= this.totalBits;
  }

  readBits(n: number): number {
    if (n < 1 || n > 16) throw new RangeError(`readBits: n must be 1..16, got ${n}`);
    if (this.pos + n > this.totalBits) throw new RangeError('readBits: past EOF');
    const v = this.readBitsUnchecked(n);
    this.pos += n;
    return v;
  }

  peek(n: number): number {
    if (n < 1 || n > 16) throw new RangeError(`peek: n must be 1..16, got ${n}`);
    if (this.pos + n > this.totalBits) throw new RangeError('peek: past EOF');
    return this.readBitsUnchecked(n);
  }

  advance(n: number): void {
    if (n < 0) throw new RangeError(`advance: n must be >= 0, got ${n}`);
    if (this.pos + n > this.totalBits) throw new RangeError('advance: past EOF');
    this.pos += n;
  }

  alignToByte(): void {
    const rem = this.pos & 7;
    if (rem !== 0) this.pos += 8 - rem;
  }

  readBytes(n: number): Uint8Array {
    if (n < 0) throw new RangeError(`readBytes: n must be >= 0, got ${n}`);
    if ((this.pos & 7) !== 0) throw new Error('readBytes: reader is not byte-aligned');
    const byteStart = this.pos >> 3;
    if (byteStart + n > this.bytes.length) throw new RangeError('readBytes: past EOF');
    const slice = this.bytes.slice(byteStart, byteStart + n);
    this.pos += n * 8;
    return slice;
  }

  private readBitsUnchecked(n: number): number {
    // LSB-first: bit i of the stream = bit (i % 8) of byte (i >> 3), least-significant first.
    let value = 0;
    let filled = 0;
    let bitIdx = this.pos;
    while (filled < n) {
      const byte = this.bytes[bitIdx >> 3];
      const bitInByte = bitIdx & 7;
      const take = Math.min(8 - bitInByte, n - filled);
      const chunk = (byte >> bitInByte) & ((1 << take) - 1);
      value |= chunk << filled;
      filled += take;
      bitIdx += take;
    }
    return value;
  }
}
