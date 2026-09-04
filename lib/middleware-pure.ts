/**
 * Pure middleware composition utilities.
 *
 * Implements a Koa-style "onion" middleware pipeline: each middleware receives
 * a context and a `next` function, and may perform work before and/or after
 * the downstream pipeline runs. All functions are pure with respect to external
 * state — they only mutate the context object passed in by the caller.
 *
 * No I/O, no global state, safe to use in workers, servers, and tests.
 */

/**
 * A mutable bag of values passed through the middleware pipeline. Middlewares
 * may read from and write to `state` to share information with downstream or
 * upstream middlewares.
 */
export type MiddlewareContext<TState extends Record<string, unknown> = Record<string, unknown>> = {
  request: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response?: {
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
  };
  state: TState;
};

/** Function invoked to continue down the pipeline. */
export type MiddlewareNext = () => Promise<void> | void;

/** A single middleware function. */
export type Middleware<TState extends Record<string, unknown> = Record<string, unknown>> = (
  context: MiddlewareContext<TState>,
  next: MiddlewareNext,
) => Promise<void> | void;

/** An ordered list of middlewares. */
export type MiddlewareChain<TState extends Record<string, unknown> = Record<string, unknown>> =
  Middleware<TState>[];

/**
 * Composes a chain of middlewares into a single middleware. Execution is
 * nested: when middleware N calls `next()`, middleware N+1 begins; when N+1
 * returns, N's post-`next()` code runs. The composed function calls the
 * provided `next` argument after the last middleware in the chain.
 *
 * Throws when a middleware calls `next()` more than once.
 */
export function composeMiddleware<TState extends Record<string, unknown> = Record<string, unknown>>(
  middlewares: MiddlewareChain<TState>,
): Middleware<TState> {
  return async function composed(context, next) {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      const fn: Middleware<TState> | undefined =
        i < middlewares.length ? middlewares[i] : (next as Middleware<TState> | undefined);
      if (!fn) return;
      await fn(context, () => dispatch(i + 1));
    }

    await dispatch(0);
  };
}

/**
 * Runs a chain of middlewares against the given context and returns the
 * (possibly mutated) context. Equivalent to composing the chain with an empty
 * terminal `next` and invoking it once.
 */
export async function applyMiddleware<TState extends Record<string, unknown> = Record<string, unknown>>(
  middlewares: MiddlewareChain<TState>,
  context: MiddlewareContext<TState>,
): Promise<MiddlewareContext<TState>> {
  const chain = composeMiddleware(middlewares);
  await chain(context, async () => {
    /* terminal — nothing to do */
  });
  return context;
}
