import 'koa';

declare module 'koa' {
  interface Request {
    body?: never;
    files?: never;
    rawBody?: string;
  }
}

export {};
