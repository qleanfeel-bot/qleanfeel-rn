export type HttpErrorCode =
  | 'BadRequest'
  | 'Unauthorized'
  | 'Forbidden'
  | 'NotFound'
  | 'ServerError'
  | 'NetworkError'
  | 'UnexpectedResponse';

/** Safe transport failure. It intentionally contains no response/body/token data. */
export class HttpError extends Error {
  public constructor(public readonly code: HttpErrorCode) {
    super(code);
    this.name = 'HttpError';
  }
}
