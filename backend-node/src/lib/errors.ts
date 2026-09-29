/**
 * Application error + FastAPI-compatible error shape.
 *
 * The frontend (frontend/src/api/client.ts) reads `error.detail` as either a
 * string OR an array of { msg }. We reproduce that exactly so the frontend's
 * error handling keeps working unchanged.
 */

export class AppError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

export const httpError = (status: number, detail: string) =>
  new AppError(status, detail);

/** Shorthand constructors mirroring the Python HTTPExceptions. */
export const badRequest = (d: string) => new AppError(400, d);
export const unauthorized = (d: string) => new AppError(401, d);
export const notFound = (d: string) => new AppError(404, d);
export const conflict = (d: string) => new AppError(409, d);
