/*
 * Backend framework for Node.js
 *
 * @description API Router for Koa middleware
 * @author Sasaki, Naoki <nsasaki@sal.co.jp>
 */

import { Readable, PassThrough } from 'stream';
import { Context } from 'koa';
import Router from '@koa/router';
import JSZip from 'jszip';
import iconv from 'iconv-lite';
import JSONStream from 'jsonstream-ts';
import koaBody from 'koa-body';
import ArrayStream from './ArrayStream';
import { APIParam, Argument } from '../@types/APIParam';

type BodyMiddlewareOptions = {
  json?: boolean;
  encoding?: string;
  multipart?: boolean;
  patchNode?: boolean;
  patchKoa?: boolean;
  jsonLimit?: string | number;
  formLimit?: string | number;
  textLimit?: string | number;
  urlencoded?: boolean;
  text?: boolean;
  jsonStrict?: boolean;
  includeUnparsed?: boolean;
};

type RouteOptions = { prefix: string; body: BodyMiddlewareOptions };

/**
 * Response body formatter.
 * @param ctx - Koa context instance
 * @param apiParam - API parameter definitions
 */
abstract class AbstractResponseFormatter {
  // NOTE: constructor has required for type definitions
  // eslint-disable-next-line no-useless-constructor
  constructor(protected ctx: Context, protected apiParam: APIParam) {}

  /**
   * @param data - target data
   */
  protected abstract format(data: unknown): unknown;
}

/**
 * JSON response formatter.
 */
class JSONFormatter extends AbstractResponseFormatter {
  /**
   * @param data - target data
   * @returns formatted stream
   * @override
   */
  format(data: unknown): PassThrough | string {
    const streamStringify = (array: Readable) => {
      return array
        .pipe(JSONStream.stringify('[', ',', ']', ''))
        .on('error', this.ctx.onerror)
        .pipe(new PassThrough());
    };

    if (data instanceof Readable) return streamStringify(data);
    else if (Array.isArray(data)) {
      return streamStringify(new ArrayStream(data));
    }

    return JSON.stringify(data);
  }
}

/**
 * ZIP archive response formatter.
 */
class ZipFormatter extends AbstractResponseFormatter {
  /**
   * @param data - target data, one or multiple (array)
   * @returns formatted data
   * @override
   */
  format(data: unknown): PassThrough {
    const containFiles = Object.assign(
      {
        fileNameKey: 'fileName',
        dataKey: 'data',
        timeStampKey: Date.now() // default to current date in UTC
      },
      this.apiParam.response ? this.apiParam.response.containFiles : {}
    );

    const compressionOpts = Object.assign(
      {
        fileNameEncoding: 'us-ascii',
        method: 'DEFLATE',
        level: 9
      },
      this.apiParam.response ? this.apiParam.response.compression : {}
    );

    const jsZip = new JSZip();
    const appendFile = (file: Record<string, unknown>) => {
      jsZip.file(
        (file[containFiles.fileNameKey] as string).replace(
          /[/\\:*?"<>|]/g,
          '_'
        ),
        file[containFiles.dataKey] as never,
        {
          binary: true,
          date: file[containFiles.timeStampKey] as Date
        }
      );
    };

    if (Array.isArray(data)) {
      data.forEach((content) => {
        appendFile(content);
      });
    } else {
      appendFile(data as never);
    }

    return jsZip
      .generateNodeStream({
        streamFiles: true,
        encodeFileName: (fileName): string => {
          return iconv
            .encode(fileName, compressionOpts.fileNameEncoding)
            .toString();
        },
        compression: compressionOpts.method,
        compressionOptions: {
          level: compressionOpts.level
        }
      })
      .on('error', this.ctx.onerror)
      .pipe(new PassThrough());
  }
}

/**
 * Raw response formatter.
 */
class RawFormatter extends AbstractResponseFormatter {
  /**
   * @param data - target data
   * @returns through data
   * @override
   */
  format(
    data: unknown /* Readable | Buffer | string */
  ): PassThrough | Buffer | string {
    if (data instanceof Readable) {
      return data.on('error', this.ctx.onerror).pipe(new PassThrough());
    } else if (typeof data === 'string' || data instanceof Buffer) {
      return data;
    }
    return JSON.stringify(data);
  }
}

/**
 * HTTP methods handler class.
 *
 * @param apiParam - API definitions
 * @param router - router instance
 * @param [opts] - option parameters
 */
abstract class AbstractHttpMethod {
  // NOTE: constructor has required for type definitions
  // eslint-disable-next-line no-useless-constructor
  constructor(
    /* API definitions */
    protected apiParam: APIParam,
    /* Router instance */
    protected router: Router,
    /* option parameters for koa-router, koa-body */
    protected opts: RouteOptions
  ) {}

  /**
   * Make a URI string.
   *
   * @returns created URI string
   */
  protected _makeUrl(): string {
    let url = this.apiParam.interface.name;
    if (this.apiParam.interface.args && this.apiParam.interface.args.length) {
      this.apiParam.interface.args.forEach((arg, index) => {
        const onlyValue =
          arg.subset === false ? false : arg.subset === true || index === 0;
        url += '/' + (onlyValue ? `:${arg.key}` : `${arg.key}/:${arg.key}`);
      });
    }
    return url;
  }

  /**
   * Make parameter values
   *
   * @param ctx - koa context
   * @returns values
   */
  protected _makeParams(ctx: Context): (string | number | boolean)[] {
    const args: (string | number | boolean)[] = [];

    if (this.apiParam.interface.args) {
      this.apiParam.interface.args.forEach((arg) => {
        AbstractHttpMethod._validate(arg, ctx.params[arg.key], false);
        args.push(
          arg.type === 'number'
            ? Number(ctx.params[arg.key])
            : arg.type === 'boolean'
            ? ctx.params[arg.key].toLowerCase() === 'true'
            : ctx.params[arg.key]
        );
      });
    }

    if (this.apiParam.interface.options) {
      const optionParams = this.parseQueryParams(ctx.url);

      this.apiParam.interface.options.forEach((option) => {
        const toString = (
          v: string | string[] | number | boolean | undefined
        ): string | number | boolean | undefined => {
          return Array.isArray(v) ? v.join(',') : v;
        };

        AbstractHttpMethod._validate(
          option,
          toString(optionParams[option.key]),
          true
        );

        const value =
          optionParams[option.key] === undefined && option.default !== undefined
            ? option.default
            : toString(optionParams[option.key]);

        if (value !== undefined) {
          args.push(
            option.type === 'number'
              ? Number(value)
              : option.type === 'boolean' && typeof value === 'string'
              ? (value as string).toLowerCase() === 'true'
              : value
          );
        }
      });
    }

    if (this.apiParam.body && this.apiParam.body.params) {
      this.apiParam.body.params.forEach((param) => {
        const value =
          ctx.request.body[param.key] === undefined &&
          param.default !== undefined
            ? param.default
            : ctx.request.body[param.key];
        AbstractHttpMethod._validate(param, value, true);
        args.push(value);
      });
    }

    return args;
  }

  /**
   * Checks parameter validation.
   *
   * @param param - URL arguments and options or request body parameters
   * @param values - parameter value
   * @param canOmit - can be omitted parameter
   * @throws parameter validation error
   * @static
   */
  private static _validate(
    param: Argument,
    values: string | number | boolean | undefined,
    canOmit: boolean
  ): void {
    const value = Array.isArray(values) ? values.join(',') : values;

    if (canOmit && value === undefined) {
      if (param.required) throw new TypeError(`'${param.key}' is not defined.`);
      return;
    }

    switch (param.type) {
      case 'number': {
        const evaluateValue = typeof value !== 'number' ? Number(value) : value;
        if (Number.isNaN(evaluateValue)) {
          throw new TypeError(
            `Invalid number type '${value}' of key ${param.key}.`
          );
        }
        if (param.validate) {
          if (
            param.validate.min !== undefined &&
            evaluateValue < param.validate.min
          ) {
            throw new TypeError(
              `'${param.key}' value ${evaluateValue} greater than ${param.validate.min}.`
            );
          }
          if (
            param.validate.max !== undefined &&
            evaluateValue > param.validate.max
          ) {
            throw new TypeError(
              `'${param.key}' value ${evaluateValue} less than ${param.validate.max}.`
            );
          }
        }
        break;
      }
      case 'string': {
        if (typeof value !== 'string') {
          throw new TypeError(`Invalid type. '${param.key}' must be string.`);
        }
        if (param.validate) {
          if (param.validate.match) {
            if (!(param.validate.match instanceof RegExp)) {
              throw new TypeError(`'${param.key}' must be RegExp.`);
            }
            if (!param.validate.match.test(value)) {
              throw new TypeError(
                `'${param.key}' is not match with RegExp patterns.`
              );
            }
          }
          if (
            param.validate.length !== undefined &&
            value.length !== param.validate.length
          ) {
            throw new TypeError(
              `'${param.key}' length must be ${param.validate.length} characters.`
            );
          }
          if (
            param.validate.minLength !== undefined &&
            value.length < param.validate.minLength
          ) {
            throw new TypeError(
              `'${param.key}' length greater than ${param.validate.minLength} characters.`
            );
          }
          if (
            param.validate.maxLength !== undefined &&
            value.length > param.validate.maxLength
          ) {
            throw new TypeError(
              `'${param.key}' length less than ${param.validate.maxLength} characters.`
            );
          }
        }
        break;
      }
      case 'boolean': {
        if (
          typeof value === 'boolean' ||
          (typeof value === 'string' &&
            (value.toLowerCase() === 'true' || value.toLowerCase() === 'false'))
        ) {
          break;
        }
        throw new TypeError(`'${param.key}' must be 'true' or 'false'.`);
      }
      default: {
        // NOTE: will not be reached because type guarded
        throw new TypeError(
          `Unrecognized type '${param.type}'. type must be 'string', 'number' and 'boolean'.`
        );
      }
    }
  }

  /**
   * Parses query parameters.
   * @param url - URL includes or not includes query parameters
   * @returns parsed query parameters
   */
  private parseQueryParams(url: string): Record<string, string> {
    const result: Record<string, string> = {};

    if (url.includes('?')) {
      const params = new URLSearchParams(url.substring(url.indexOf('?') + 1));
      for (const [key, value] of params.entries())
        Object.assign(result, { [key]: value });
    }

    return result;
  }

  /**
   * Register a single route.
   * @param ctx - koa context
   * @param next - koa next()
   */
  protected async _registerRoute(
    ctx: Context,
    next: () => void
  ): Promise<void> {
    try {
      const params = this._makeParams(ctx);
      const options = this.parseQueryParams(ctx.url);
      const result = await this.apiParam.observer.apply(this, [
        ctx,
        ...params,
        options
      ]);

      if (this.apiParam.response && this.apiParam.response.contentType) {
        ctx.response.type = this.apiParam.response.contentType;
      }

      const responseFormatterFactory = (contentType: string) => {
        switch (contentType.toLowerCase()) {
          case 'application/json':
            return new JSONFormatter(ctx, this.apiParam);
          case 'application/zip':
            return new ZipFormatter(ctx, this.apiParam);
          default:
            return new RawFormatter(ctx, this.apiParam);
        }
      };

      ctx.body = responseFormatterFactory(ctx.response.type).format(result);
    } catch (err) {
      ctx.throw(
        err instanceof TypeError ? 400 : 500,
        err instanceof Error ? err.message : JSON.stringify(err)
      );
    }
    return next();
  }

  /**
   * Sets a route, must be implemented in extended classes.
   */
  abstract setRoute(): void;
}

/**
 * HTTP Get handler.
 */
class HttpGet extends AbstractHttpMethod {
  /** @override */
  setRoute(): void {
    this.router.get(this._makeUrl(), async (ctx: Context, next: () => void) => {
      await this._registerRoute(ctx, next);
    });
  }
}

/**
 * HTTP Post handler.
 */
class HttpPost extends AbstractHttpMethod {
  /** @override */
  setRoute(): void {
    this.router.post(
      this._makeUrl(),
      koaBody(this.opts.body),
      async (ctx: Context, next: () => void) => {
        await this._registerRoute(ctx, next);
      }
    );
  }
}

/**
 * HTTP Put handler.
 */
class HttpPut extends AbstractHttpMethod {
  /** @override */
  setRoute(): void {
    this.router.put(
      this._makeUrl(),
      koaBody(this.opts.body),
      async (ctx: Context, next: () => void) => {
        await this._registerRoute(ctx, next);
      }
    );
  }
}

/**
 * HTTP Delete handler.
 */
class HttpDelete extends AbstractHttpMethod {
  /** @override */
  setRoute(): void {
    this.router.delete(
      this._makeUrl(),
      async (ctx: Context, next: () => void) => {
        await this._registerRoute(ctx, next);
      }
    );
  }
}

/**
 * AbstractRoute - Route definition for Koa middleware.
 *
 * @param opts - options
 * @example
 * class ContentRoute extends AbstractRoute {
 *   constructor() {
 *     super({ prefix: '/content' });
 *   }
 * }
 */
export abstract class AbstractRoute {
  /** option parameters for koa-router, koa-body */
  protected opts: RouteOptions;
  /** koa-router instance */
  public router: Router;

  protected constructor(
    opts: { prefix?: string; body?: BodyMiddlewareOptions } = {}
  ) {
    this.opts = {
      prefix: opts.prefix || '',
      body: opts.body || ({} as BodyMiddlewareOptions)
    };

    if (!this.opts.prefix.endsWith('/')) this.opts.prefix += '/';
    this.router = new Router(this.opts);
  }

  /**
   * Adds routes to the @koa/router stacks.
   *
   * @param apiParams - API definitions
   * @returns http method handler
   * @throws bad request method
   */
  routeAdd(apiParams: APIParam[]): void {
    /**
     * HTTP method instance factory
     * @param apiParam - API parameters
     * @param router - router instance
     * @param opts - option parameters for koa-router, koa-body
     * @return created instance
     * @throws unknown method error
     */
    const httpMethodFactory = (
      apiParam: APIParam,
      router: Router,
      opts: RouteOptions
    ) => {
      switch (apiParam.method.toUpperCase()) {
        case 'GET':
        case 'HEAD':
          return new HttpGet(apiParam, router, opts);
        case 'POST':
          return new HttpPost(apiParam, router, opts);
        case 'PUT':
          return new HttpPut(apiParam, router, opts);
        case 'DELETE':
          return new HttpDelete(apiParam, router, opts);
        // TODO: to be implemented
        case 'PATCH':
        case 'OPTIONS':
        default:
          throw new Error(`Unsupported method '${apiParam.method}'`);
      }
    };

    apiParams.forEach((apiParam) => {
      httpMethodFactory(apiParam, this.router, this.opts).setRoute();
    });
  }
}
