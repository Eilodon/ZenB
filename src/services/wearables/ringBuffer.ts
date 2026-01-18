export class RingBuffer<T> {
  private buf: T[] = [];
  private readonly maxLen: number;

  constructor(maxLen: number) {
    if (!Number.isFinite(maxLen) || maxLen <= 0) {
      throw new Error('RingBuffer maxLen must be a positive number');
    }
    this.maxLen = maxLen;
  }

  push(value: T): void {
    this.buf.push(value);
    if (this.buf.length > this.maxLen) {
      this.buf.splice(0, this.buf.length - this.maxLen);
    }
  }

  pushMany(values: T[]): void {
    if (values.length === 0) return;
    this.buf.push(...values);
    if (this.buf.length > this.maxLen) {
      this.buf.splice(0, this.buf.length - this.maxLen);
    }
  }

  clear(): void {
    this.buf = [];
  }

  toArray(): T[] {
    return [...this.buf];
  }

  get length(): number {
    return this.buf.length;
  }
}

