import 'koa';

declare module 'koa' {
  interface Request {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    files?: any;
    rawBody?: string;
  }
}

export {};
