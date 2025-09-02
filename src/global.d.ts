import 'koa';

declare module 'koa' {
  interface Request {
    body?: unknown;
    files?: unknown;
    rawBody?: string;
  }
}

export {};
