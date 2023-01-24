/* AbstractRoute.spec.js: Unit test code for routing middleware.
 * @author Sasaki, Naoki <nsasaki@sal.co.jp> on May 20, 2019
 */

import { Readable } from 'stream';
import Koa from 'koa';
import request from 'supertest';
import { AbstractRoute, APIParam } from '../src';
import ArrayStream from '../src/ArrayStream';

describe('AbstractRoute', () => {
  const apiPrefix = '/api/v1';

  describe('method: get application/json, only identifier no arguments', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number',
                  validate: {
                    min: 1,
                    max: 999
                  }
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async ({ response }, id) => {
              response.set('X-Identifier', id);
              return { id };
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameter, lowest value', async () => {
      const id = 1;
      const uri = `${apiPrefix}/api1/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({ id: 1 });
      expect(response.headers['x-identifier']).toBe('1');
    });

    test('normally parameter, highest value', async () => {
      const id = 999;
      const uri = `${apiPrefix}/api1/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({ id: 999 });
      expect(response.headers['x-identifier']).toBe('999');
    });

    test('abnormally parameter, too lower)', async () => {
      const id = 0;
      const uri = `${apiPrefix}/api1/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });

    test('abnormally parameter, too higher)', async () => {
      const id = 1000;
      const uri = `${apiPrefix}/api1/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });

    test('abnormally parameter, not a number', async () => {
      const id = 'ABC';
      const uri = `${apiPrefix}/api1/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });

    test('abnormally parameter, no value', async () => {
      const uri = `${apiPrefix}/api1/`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(404);
    });
  });

  describe('method: get application/json, identifier and arguments', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                },
                {
                  key: 'arg1',
                  type: 'string',
                  validate: {
                    maxLength: 10
                  }
                },
                {
                  key: 'arg2',
                  type: 'string',
                  validate: {
                    match: /^ID\d/,
                    maxLength: 10
                  }
                },
                {
                  key: 'arg3',
                  type: 'string',
                  validate: {
                    length: 8
                  }
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, id, arg1, arg2, arg3) => {
              return { id, values: [arg1, arg2, arg3] };
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameter, max length', async () => {
      const id = 123;
      const arg1 = 'Value 1';
      const arg2 = 'ID00000001';
      const arg3 = 'ABCDEFGH';
      const uri = `${apiPrefix}/api1/${id}/arg1/${arg1}/arg2/${arg2}/arg3/${arg3}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        id,
        values: [arg1, arg2, arg3]
      });
    });

    test('abnormally parameter, max length', async () => {
      const id = 123;
      const arg1 = 'Value';
      const arg2 = 'ID000000001'; // over 1 char
      const arg3 = 'ABCDEFGH';
      const uri = `${apiPrefix}/api1/${id}/arg1/${arg1}/arg2/${arg2}/arg3/${arg3}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });

    test('normally parameter, minimum length', async () => {
      const id = 0;
      const arg1 = 'Value 123';
      const arg2 = 'ID1';
      const arg3 = 'ABCDEFGH';
      const uri = `${apiPrefix}/api1/${id}/arg1/${arg1}/arg2/${arg2}/arg3/${arg3}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id,
        values: [arg1, arg2, arg3]
      });
    });

    test('abnormally parameter, un-match regex pattern', async () => {
      const id = 0;
      const arg1 = 'Value';
      const arg2 = 'ID-FOO';
      const arg3 = 'ABCDEFGH';
      const uri = `${apiPrefix}/api1/${id}/arg1/${arg1}/arg2/${arg2}/arg3/${arg3}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });

    test('abnormally parameter, un-match string length', async () => {
      const id = 0;
      const arg1 = 'Value';
      const arg2 = 'ID00000001';
      const arg3 = 'ABC'; // not enough length
      const uri = `${apiPrefix}/api1/${id}/arg1/${arg1}/arg2/${arg2}/arg3/${arg3}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });
  });

  describe('method: post application/json, identifier and body arguments', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'POST',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ]
            },
            body: {
              params: [
                {
                  key: 'param1',
                  type: 'string',
                  required: true,
                  validate: {
                    minLength: 5,
                    maxLength: 10
                  }
                },
                {
                  key: 'param2',
                  type: 'string',
                  default: 'Default Value',
                  validate: {
                    maxLength: 20
                  }
                },
                {
                  key: 'param3',
                  type: 'string',
                  validate: {
                    match: /^(Foo|Bar)$/
                  }
                },
                {
                  key: 'param4',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, id, param1, param2, param3, param4) => {
              return { id, values: [param1, param2, param3, param4] };
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameter, max length', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDEFGHIJ', // just 10 chars
        param2: 'Parameter Value 2',
        param3: 'Foo',
        param4: 12345
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        id,
        values: [data.param1, data.param2, data.param3, data.param4]
      });
    });

    test('abnormally parameter, max length', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDEFGHIJK', // over 1 char
        param2: 'Parameter Value 2',
        param3: 'Foo'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(400);
      expect(response.text).toBe("'param1' length less than 10 characters.");
    });

    test('normally parameter, min length', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDE', // just 5 chars
        param2: 'Parameter Value 2',
        param3: 'Bar'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id,
        values: [data.param1, data.param2, data.param3, null]
      });
    });

    test('abnormally parameter, min length', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCD', // not enough 1 char
        param2: 'Parameter Value 2',
        param3: 'Foo'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(400);
      expect(response.text).toBe("'param1' length greater than 5 characters.");
    });

    test('normally parameter, default value', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDEFG',
        param3: 'Bar'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id,
        values: [data.param1, 'Default Value', data.param3, null]
      });
    });

    test('abnormally parameter, default value with validation', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDEFG',
        param2: 'A'.repeat(21),
        param3: 'Bar'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(400);
      expect(response.text).toBe("'param2' length less than 20 characters.");
    });

    test('abnormally parameter, required parameter', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param2: 'ABCDEFG',
        param3: 'Foo'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(400);
      expect(response.text).toBe("'param1' is not defined.");
    });

    test('abnormally parameter, un-match regex parameter', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDEFG',
        param2: 'Value 2',
        param3: 'Other'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(400);
      expect(response.text).toBe("'param3' is not match with RegExp patterns.");
    });

    test('abnormally parameter, un-match parameter type (string)', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDEFG',
        param2: 'Value 2',
        param3: 123
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(400);
      expect(response.text).toBe("Invalid type. 'param3' must be string.");
    });

    test('abnormally parameter, un-match parameter type (number)', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        param1: 'ABCDEFG',
        param2: 'Value 2',
        param3: 'Foo',
        param4: 'Value 4'
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(400);
      expect(response.text).toBe(
        "Invalid number type 'Value 4' of key param4."
      );
    });
  });

  describe('method: get text/plain, identifier and arguments', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                },
                {
                  key: 'arg1',
                  type: 'string'
                },
                {
                  key: 'arg2',
                  type: 'string',
                  validate: {
                    match: /^NO-\d{5}/
                  }
                }
              ]
            },
            response: {
              contentType: 'text/plain'
            },
            observer: async (ctx, id, arg1, arg2) => {
              return `id: ${id}, values: ${arg1}, ${arg2}`;
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameter', async () => {
      const id = 123;
      const arg1 = 'Value 1';
      const arg2 = 'NO-00001';
      const uri = `${apiPrefix}/api1/${id}/arg1/${arg1}/arg2/${arg2}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/plain');
      expect(response.text).toBe(`id: ${id}, values: ${arg1}, ${arg2}`);
    });
  });

  describe('method: put with result body', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'PUT',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ]
            },
            body: {
              params: [
                {
                  key: 'value',
                  type: 'string',
                  required: true
                }
              ]
            },
            response: {
              contentType: 'text/plain'
            },
            observer: async (ctx, id, value) => {
              return `record inserted id: ${id}, value: '${value}'`;
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameters', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        value: 'Value 1'
      };

      const response = await request(app.callback()).put(uri).send(data);

      expect(response.status).toBe(200);
      expect(response.text).toBe(
        `record inserted id: ${id}, value: '${data.value}'`
      );
    });
  });

  describe('method: delete with result body', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'DELETE',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'text/plain'
            },
            observer: async (ctx, id) => {
              return `record deleted id: ${id}`;
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameters', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;

      const response = await request(app.callback()).del(uri);

      expect(response.status).toBe(200);
      expect(response.text).toBe(`record deleted id: ${id}`);
    });
  });

  describe('method: get application/json and text/plain, stream', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'count',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, count) => {
              const array = [];
              for (let index = 0; index < count; index++) {
                array.push({ num: index });
              }
              return new ArrayStream(array); // return stream
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api2',
              args: [
                {
                  key: 'count',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, count) => {
              const array = [];
              for (let index = 0; index < count; index++) {
                array.push({ num: index });
              }
              return array;
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api3',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, id) => {
              return { id };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api4',
              args: [
                {
                  key: 'count',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'text/plain'
            },
            observer: async (ctx, count) => {
              let counter = 0;
              return new Readable({
                read() {
                  this.push(counter++ < count ? 'foo' : null);
                }
              });
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameter, stream', async () => {
      const count = 10000;
      const uri = `${apiPrefix}/api1/${count}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['transfer-encoding']).toBe('chunked');

      const array = [];
      for (let index = 0; index < count; index++) {
        array.push({ num: index });
      }
      expect(response.body).toEqual(array);
    });

    test('normally parameter, array', async () => {
      const count = 10000;
      const uri = `${apiPrefix}/api2/${count}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['transfer-encoding']).toBe('chunked');

      const array = [];
      for (let index = 0; index < count; index++) {
        array.push({ num: index });
      }
      expect(response.body).toEqual(array);
    });

    test('normally parameter, object (not stream', async () => {
      const id = 1234;
      const uri = `${apiPrefix}/api3/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['transfer-encoding']).toBe(undefined);

      expect(response.body).toEqual({ id });
    });

    test('normally parameter, string', async () => {
      const count = 10;
      const uri = `${apiPrefix}/api4/${count}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/plain');
      expect(response.headers['transfer-encoding']).toBe('chunked');

      expect(response.text).toBe('foo'.repeat(count));
    });
  });

  describe('method: get application/zip, stream', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'singleZip',
              args: [
                {
                  key: 'count',
                  type: 'number'
                },
                {
                  key: 'fileName',
                  type: 'string'
                }
              ]
            },
            response: {
              contentType: 'application/zip',
              containFiles: {
                fileNameKey: 'fileName',
                timeStampKey: 'timeStamp',
                dataKey: 'data'
              },
              compression: {
                fileNameEncoding: 'us-ascii',
                method: 'DEFLATE',
                level: 9
              }
            },
            observer: async ({ response }, count, fileName) => {
              response.attachment(fileName);
              return {
                fileName: 'file1.bin',
                timeStamp: new Date(1558398147051), // 2019-05-21T00:22:27.051Z
                data: Buffer.alloc(count, 0x00)
              };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'defaultTimestamp',
              args: [
                {
                  key: 'count',
                  type: 'number'
                },
                {
                  key: 'fileName',
                  type: 'string'
                }
              ]
            },
            response: {
              contentType: 'application/zip',
              containFiles: {
                fileNameKey: 'fileName',
                dataKey: 'data'
              },
              compression: {
                fileNameEncoding: 'Shift_JIS',
                method: 'DEFLATE',
                level: 9
              }
            },
            observer: async ({ response }, count, fileName) => {
              response.attachment(fileName);
              return {
                fileName: 'file1.bin',
                timeStamp: new Date(1558398147051), // 2019-05-21T00:22:27.051Z
                data: Buffer.alloc(count, 0x00)
              };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'multipleZip',
              args: [
                {
                  key: 'count',
                  type: 'number'
                },
                {
                  key: 'fileName',
                  type: 'string'
                }
              ]
            },
            response: {
              contentType: 'application/zip',
              containFiles: {
                fileNameKey: 'fileName',
                timeStampKey: 'timeStamp',
                dataKey: 'data'
              }
            },
            observer: async ({ response }, count, fileName) => {
              response.attachment(fileName);
              return [
                {
                  fileName: 'file1.bin',
                  timeStamp: new Date(1558398147051), // 2019-05-21T00:22:27.051Z
                  data: Buffer.alloc(count, 0x00)
                },
                {
                  fileName: 'file2.bin',
                  timeStamp: new Date(1558398147051), // 2019-05-21T00:22:27.051Z
                  data: Buffer.alloc(count, 0xff)
                }
              ];
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally single container, default timestamp', async () => {
      const count = 1000;
      const fileName = 'singleFile.zip';
      const uri = `${apiPrefix}/defaultTimestamp/${count}/fileName/${fileName}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/zip');
      expect(response.headers['transfer-encoding']).toBe('chunked');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="${fileName}"`
      );
      expect(Buffer.from(response.text).length).toBeGreaterThan(150);
      // can't match to snapshot, because to be changed timestamp every time
    });

    test('normally single container', async () => {
      const count = 1000;
      const fileName = 'singleFile.zip';
      const uri = `${apiPrefix}/singleZip/${count}/fileName/${fileName}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/zip');
      expect(response.headers['transfer-encoding']).toBe('chunked');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="${fileName}"`
      );
      expect(Buffer.from(response.text).toString('base64')).toMatchSnapshot();
    });

    test('normally multiple container', async () => {
      const count = 1000;
      const fileName = 'multipleFile.zip';
      const uri = `${apiPrefix}/multipleZip/${count}/fileName/${fileName}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/zip');
      expect(response.headers['transfer-encoding']).toBe('chunked');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="${fileName}"`
      );
      expect(Buffer.from(response.text).toString('base64')).toMatchSnapshot();
    });
  });

  describe('abnormally regex type', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'string',
                  validate: {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    match: 'foo' // Boo!
                  }
                }
              ]
            },
            observer: async (ctx, id) => {
              return `id: ${id}`;
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('abnormally regex instance', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
      expect(response.text).toBe("'id' must be RegExp.");
    });
  });

  describe('abnormally method', () => {
    test('incorrect method', async () => {
      class Route extends AbstractRoute {
        constructor() {
          super({ prefix: apiPrefix });

          const apiParams: APIParam[] = [
            {
              method: 'READ', // Boo!
              interface: {
                name: 'api1',
                args: [
                  {
                    key: 'id',
                    type: 'number'
                  }
                ]
              },
              observer: async (ctx, id) => {
                return `id: ${id}`;
              }
            }
          ];

          this.routeAdd(apiParams);
        }
      }

      let error: Error | undefined = undefined;

      try {
        const app = new Koa();
        const route = new Route();
        app.use(route.router.routes());
      } catch (err) {
        error = err as Error;
      }

      expect(error !== undefined).toBeTruthy();
      expect((error as Error).toString()).toBe(
        "Error: Unsupported method 'READ'"
      );
    });
  });

  describe('empty response body', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1'
            },
            response: {
              contentType: 'text/plain'
            },
            observer: () => {
              return undefined;
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api2'
            },
            response: {
              contentType: 'application/json'
            },
            observer: () => {
              return undefined;
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test("normally, text/plain 'undefined' body", async () => {
      const uri = `${apiPrefix}/api1`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBeLessThan(299);
      expect(response.text).toBe('');
    });

    test("normally, application/json 'undefined' body", async () => {
      const uri = `${apiPrefix}/api2`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBeLessThan(299);
      expect(response.text).toBe('');
    });
  });

  describe('subset parameters', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'string'
                }
              ]
            },
            observer: async (ctx, id) => {
              return `id: ${id}`;
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api2',
              args: [
                {
                  key: 'id',
                  type: 'string',
                  subset: false
                }
              ]
            },
            observer: async (ctx, id) => {
              return `id: ${id}`;
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api3',
              args: [
                {
                  key: 'id',
                  type: 'number'
                },
                {
                  key: 'value',
                  type: 'string'
                },
                {
                  key: 'other',
                  type: 'string',
                  subset: true
                }
              ]
            },
            observer: async (ctx, id, value, other) => {
              return `id: ${id}, value: ${value}, other: ${other}`;
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally default subset 1st parameter', async () => {
      const value = 'value';
      const uri = `${apiPrefix}/api1/${value}`;

      expect(route.router.stack[0].methods.includes('GET')).toBeTruthy();
      expect(route.router.stack[0].path).toBe('/api/v1/api1/:id');

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.text).toBe(`id: ${value}`);
    });

    test('normally non-subset 1st parameter', async () => {
      const value = 'Value1';
      const uri = `${apiPrefix}/api2/id/${value}`;

      expect(route.router.stack[1].methods.includes('GET')).toBeTruthy();
      expect(route.router.stack[1].path).toBe('/api/v1/api2/id/:id');

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.text).toBe(`id: ${value}`);
    });

    test('normally including subset parameter', async () => {
      const id = 123;
      const value = 'Value1';
      const other = 'Other Value';
      const uri = `${apiPrefix}/api3/${id}/value/${value}/${other}`;

      expect(route.router.stack[2].methods.includes('GET')).toBeTruthy();
      expect(route.router.stack[2].path).toBe(
        '/api/v1/api3/:id/value/:value/:other'
      );

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.text).toBe(`id: ${id}, value: ${value}, other: ${other}`);
    });
  });

  describe('option parameters', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ],
              options: [
                {
                  key: 'option',
                  type: 'string',
                  required: true
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: (ctx, id, option) => {
              return { id, option };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api2',
              args: [
                {
                  key: 'id',
                  type: 'string'
                }
              ],
              options: [
                {
                  key: 'option1',
                  type: 'number',
                  required: true
                },
                {
                  key: 'option2',
                  type: 'string',
                  required: false,
                  default: 'Value2'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: (ctx, id, option1, option2) => {
              return { id, options: [option1, option2] };
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally required option parameter', async () => {
      const id = 12345;
      const option = 'Value1';
      const uri = `${apiPrefix}/api1/${id}?option=${option}`;

      expect(route.router.stack[0].path).toBe('/api/v1/api1/:id');

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id, option });
    });

    test('normally not required option parameter', async () => {
      const id = 'ID12345';
      const option1 = 3;
      const uri = `${apiPrefix}/api2/${id}?option1=${option1}`;

      expect(route.router.stack[1].path).toBe('/api/v1/api2/:id');

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id,
        options: [option1, 'Value2']
      });
    });
  });

  describe('arg type of boolean', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'GET',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'arg',
                  type: 'boolean'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, arg) => {
              return { value: arg };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api2',
              args: [
                {
                  key: 'id',
                  type: 'number'
                },
                {
                  key: 'arg1',
                  type: 'boolean'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, id, arg1) => {
              return { id, value: arg1 };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api3',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ],
              options: [
                {
                  key: 'option1',
                  type: 'boolean',
                  required: true
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, id, option1) => {
              return { id, value: option1 };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api4',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ],
              options: [
                {
                  key: 'option1',
                  type: 'boolean',
                  default: true
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, id, option1) => {
              return { id, value: option1 };
            }
          },
          {
            method: 'GET',
            interface: {
              name: 'api5',
              args: [
                {
                  key: 'id',
                  type: 'number'
                },
                {
                  key: 'arg1',
                  type: 'boolean'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async (ctx, id, arg1) => {
              return { id, value: arg1 };
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameter, url parameter', async () => {
      const arg = true;
      const uri = `${apiPrefix}/api1/${arg}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        value: arg
      });
    });

    test('normally parameter, 2nd url parameter', async () => {
      const id = 123;
      const arg1 = false;
      const uri = `${apiPrefix}/api2/${id}/arg1/${arg1}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        id,
        value: arg1
      });
    });

    test('normally parameter, option parameter', async () => {
      const id = 123;
      const option1 = true;
      const uri = `${apiPrefix}/api3/${id}?option1=${option1}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        id,
        value: option1
      });
    });

    test('abnormally parameter, required option parameter', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api3/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });

    test('normally parameter, default option parameter', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api4/${id}`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        id,
        value: true
      });
    });

    test('abnormally parameter, invalid value', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api5/${id}/arg1/foo`;

      const response = await request(app.callback()).get(uri);

      expect(response.status).toBe(400);
    });
  });

  describe('koa-body options, not change jsonLimit by default 1mb', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({ prefix: apiPrefix });

        const apiParams: APIParam[] = [
          {
            method: 'POST',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async ({ request }, id) => {
              return { id, result: request.body };
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('abnormally parameter, body size over 1mb', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        value: '0'.repeat(1024 * 2000) // 2mb
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(413); // Request Entity Too Large
    });
  });

  describe('koa-body options, change jsonLimit to 10mb', () => {
    class Route extends AbstractRoute {
      constructor() {
        super({
          prefix: apiPrefix,
          body: {
            jsonLimit: '10mb' // default `1mb`. see more information https://www.npmjs.com/package/koa-body
          }
        });

        const apiParams: APIParam[] = [
          {
            method: 'POST',
            interface: {
              name: 'api1',
              args: [
                {
                  key: 'id',
                  type: 'number'
                }
              ]
            },
            response: {
              contentType: 'application/json'
            },
            observer: async ({ request }, id) => {
              return { id, result: request.body };
            }
          }
        ];

        this.routeAdd(apiParams);
      }
    }

    const app = new Koa();
    const route = new Route();
    app.use(route.router.routes());

    test('normally parameter, body size over 1mb', async () => {
      const id = 123;
      const uri = `${apiPrefix}/api1/${id}`;
      const data = {
        value: '0'.repeat(1024 * 10000) // 10mb
      };

      const response = await request(app.callback()).post(uri).send(data);

      expect(response.status).toBe(200);
    });
  });
});
