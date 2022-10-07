// Type definitions for AbstractRoute 1.0.0
// Project: https://dev.sal.co.jp/sandbox/Playground
// Definitions by: SAL Ltd. - https://sal.co.jp
// License under the MIT
// TypeScript Version: 3.7

/* =================== USAGE ===================

    import * as AbstractRoute from './AbstractRoute'

    class API extends AbstractRoute {
      constructor() {
        super({ prefix: '/api/v1' });

 =============================================== */
/// <reference types="node" />
import * as Stream from 'stream';
import * as Koa from 'koa';

export type Validate = {
  /** minimum value of number */
  min?: number;
  /** maximum value of number */
  max?: number;
  /** minimum length of string */
  minLength?: number;
  /** maximum length of string */
  maxLength?: number;
  /** length of string */
  length?: number;
  /** match with regex pattern */
  match?: RegExp;
};

export type Options = {
  /** identifier */
  key: string;
  /** type of parameter */
  type: 'string' | 'number' | 'boolean';
  /** must be defined this parameter */
  required?: boolean;
  /** validation patterns */
  validate?: Validate;
  /** default value (validator disable if default is defined) */
  default?: string | number | boolean;
};

export type Argument = {
  /** identifier */
  key: string;
  /** type of parameter */
  type: 'string' | 'number' | 'boolean';
  /** must be defined this parameter */
  required?: boolean;
  /** value only parameter */
  subset?: boolean;
  /** validation patterns */
  validate?: Validate;
  /** default value (validator disable if default is defined) */
  default?: string | number | boolean;
};

export type Interface = {
  /** interface name */
  name: string;
  /** arguments from URI */
  args?: Argument[];
  /** option arguments from URI */
  options?: Options[];
  /** response header */
  response?: {
    /** response content type */
    contentType?: string;
  };
};

export type Body = {
  /** parameters from request body */
  params?: Argument[];
  /** request header */
  response?: {
    /** request content type */
    contentType?: string;
  };
};

export type ZipContainer = {
  /** key of result object for inner file name */
  fileNameKey: string;
  /** key of result object for inner file's time stamp */
  timeStampKey?: string;
  /** key of result object for ZIP archive buffer */
  dataKey: string;
};

export type Compression = {
  /** encoding for compressed file name (e.g. Shift_JIS) */
  fileNameEncoding?: string;
  /** encoding method */
  method?: 'DEFLATE' | 'STORE';
  /** compression level */
  level?: number;
};

export type Response = {
  /** content type to response */
  contentType?: string;
  /** container settings for ZIP archive */
  containFiles?: ZipContainer;
  /** deflate parameters */
  compression?: Compression;
};

export type APIParam = {
  /** HTTP method */
  method: string;
  /** URI parameters */
  interface: Interface;
  /** request body */
  body?: Body;
  /** response header */
  response?: Response;
  /** response processing observer */
  observer: (
    /** request, response context */
    ctx: Koa.Context,
    /** arguments for handler */
    ...any
  ) =>
    | Stream
    | Buffer
    | string
    | object
    | void
    | Promise<Stream | Buffer | string | object | void>;
};
