import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Thrown by route handlers for expected failures (not found, forbidden, bad input) —
// caught by withErrorHandling below and turned into the same `{ detail }` shape
// FastAPI's HTTPException produces, so lib/api.ts's existing response parsing keeps
// working unchanged while modules migrate one at a time.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Reads the request body as JSON, returning `undefined` for an empty body instead of
// throwing — for endpoints where the body itself is optional (e.g. /auth/refresh, which
// falls back to a cookie). A non-empty-but-malformed body is a genuine client error.
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

type RouteContext = { params: Promise<Record<string, string | string[]>> };
type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

// Mirrors main.py's unhandled_exception_handler (logs + generic 500) and FastAPI's
// default 422 validation-error response (`{ detail: [{ msg }, ...] }`).
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ detail: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { detail: err.issues.map((issue) => ({ msg: issue.message })) },
          { status: 422 },
        );
      }
      console.error(`Unhandled exception on ${request.method} ${request.url}`, err);
      return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
    }
  };
}
