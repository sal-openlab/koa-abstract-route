# [koa-abstract-route](https://www.npmjs.com/package/koa-abstract-route)

API Router for Koa@2 middleware

## Features

* Easy to define your custom API routes
* Handles higher level content types of request/response
* Stream friendly

## Setup

1. Add `koa-abstract-route` dependency to your project

```sh
$ npm install --save koa-abstract-route
```

## Example

* MyAPI.ts

```ts
import { AbstractRoute, APIParam } from 'koa-abstract-route';

export default class MyAPI extends AbstractRoute {
  constructor() {
    super({ prefix: '/api/v1' });

    /*
     * API Parameter definitions.
     */
    const apiParams: APIParam[] = [
      {
        /* Gets current server time.
         * @example
         * ```sh
         * curl -i http://127.0.0.1/api/v1/time
         * ```
         */
        method: 'GET',
        interface: {
          name: 'time',
          options: [
            {
              key: 'format',
              type: 'string',
              required: false,
              default: 'epoch',
              validate: {
                match: /^(epoch|iso)$/
              }
            }
          ]
        },
        response: {
          contentType: 'application/json'
        },
        observer: (
          { request, response }, format: string
        ): object => {
          return {
            timeStamp:
              format === 'epoch' ? Date.now() : new Date().toISOString()
          };
        }
      },
    ];

    try {
      this.routeAdd(apiParams);
    } catch (err) {
      console.error(err);
    }
  }
}
```

* Server.ts

```ts
import Koa from 'koa';
import MyAPI from './MyAPI';

const app = new Koa();
const api = new MyAPI();
app.use(api.router.routes());

const server = app.listen(80, () => {
  api.router.stack.forEach((route) => {
    console.info(`Route ${route.methods.join(', ')} ${route.path}`);
  });
});
```

## Constructor Options

### `prefix`

- Type: `String`
- Default: `''`

Prefix of URL routes.

## Development

1. Clone this repository
2. Install dependencies using `yarn install` or `npm install`
3. Start development server using `npm run dev`

## License

[MIT License](./LICENSE)

Copyright (c) [SAL Ltd.](https://sal.co.jp)
