/* ArrayStream.spec.js: Unit test code for array to stream converter.
 * @author Sasaki, Naoki <nsasaki@sal.co.jp> on May 21, 2019
 */

import ArrayStream from '../src/ArrayStream';
import { Readable } from 'stream';

describe('ArrayStream', () => {
  const streamToBe = (stream: Readable, val: string, done: () => void) => {
    let line = '';
    stream.on('data', (data) => {
      line += (line.length !== 0 ? ',' : '') + JSON.stringify(data);
    });
    stream.on('end', () => {
      expect(line).toBe(val);
      done();
    });
  };

  test('normally simple array', () => {
    return new Promise((done): void => {
      const stream = new ArrayStream([1, 2, 3, 4, 5]);

      expect(stream.readable).toBeTruthy();
      expect(stream instanceof Readable).toBeTruthy();

      streamToBe(stream, '1,2,3,4,5', done as () => void);
    });
  });

  test('normally complex array', () => {
    return new Promise((done): void => {
      const stream = new ArrayStream([
        { a: 1 },
        { b: ['x', 'y', 'z'] },
        { c: { x: 3, y: 4, z: 5 } }
      ]);

      expect(stream.readable).toBeTruthy();
      expect(stream instanceof Readable).toBeTruthy();

      streamToBe(
        stream,
        '{"a":1},{"b":["x","y","z"]},{"c":{"x":3,"y":4,"z":5}}',
        done as () => void
      );
    });
  });
});
