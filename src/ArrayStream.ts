/*
 * ArrayStream.ts
 * @description Convert array to stream array
 */

import { Readable } from 'stream';

/**
 * Creates a stream array.
 * @param ar - any source array
 */
export default class ArrayStream<T> extends Readable {
  private index: number;
  private readonly array: Array<T>;

  constructor(ar: Array<T>) {
    super({ objectMode: true });
    this.index = 0;
    this.array = ar;
  }

  public _read(): void {
    this.push(this.index < this.array.length ? this.array[this.index++] : null);
  }
}
