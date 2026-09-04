/**
 * Pure CQRS (Command Query Responsibility Segregation) primitives.
 *
 * Commands are intent-bearing write operations; queries are read
 * operations. Both flow through a single `dispatch` function that looks
 * up the appropriate handler in a registry. The dispatcher is pure: it
 * does not perform any I/O. Side-effecting work (database writes,
 * external calls) is the handler's responsibility and is expected to be
 * injected by the caller.
 */

export type CommandType = string;
export type QueryType = string;

export interface Command<T extends CommandType = CommandType> {
  type: T;
  payload: unknown;
  /** Idempotency / correlation id supplied by the caller. */
  correlationId?: string;
}

export interface Query<T extends QueryType = QueryType> {
  type: T;
  params: unknown;
  correlationId?: string;
}

export interface CommandResult {
  ok: boolean;
  /** Aggregate / entity id affected by the command, when applicable. */
  affectedId?: string;
  /** Events emitted by the command (event-sourcing style). */
  events?: ReadonlyArray<{ type: string; payload: unknown }>;
  error?: string;
}

export interface QueryResult<R = unknown> {
  ok: boolean;
  data?: R;
  error?: string;
}

export type CommandHandler<C extends Command = Command> = (
  command: C,
) => CommandResult | Promise<CommandResult>;

export type QueryHandler<Q extends Query = Query, R = unknown> = (
  query: Q,
) => QueryResult<R> | Promise<QueryResult<R>>;

export interface CqrsRegistry {
  commands: Map<CommandType, CommandHandler>;
  queries: Map<QueryType, QueryHandler>;
}

/**
 * Create an empty CQRS registry.
 */
export function createRegistry(): CqrsRegistry {
  return {
    commands: new Map(),
    queries: new Map(),
  };
}

/**
 * Register a command handler for a command type.
 * Returns a new registry; the input is not mutated.
 */
export function registerCommand<C extends Command>(
  registry: CqrsRegistry,
  type: C["type"],
  handler: CommandHandler<C>,
): CqrsRegistry {
  return {
    commands: new Map(registry.commands).set(type, handler as CommandHandler),
    queries: registry.queries,
  };
}

/**
 * Register a query handler for a query type.
 * Returns a new registry; the input is not mutated.
 */
export function registerQuery<Q extends Query, R>(
  registry: CqrsRegistry,
  type: Q["type"],
  handler: QueryHandler<Q, R>,
): CqrsRegistry {
  return {
    commands: registry.commands,
    queries: new Map(registry.queries).set(type, handler as QueryHandler),
  };
}

/**
 * Dispatch a command to its registered handler. Returns an error result
 * when no handler is registered for the command type.
 *
 * The dispatcher is async because handlers may return promises; pure
 * handlers complete on the microtask queue.
 */
export async function dispatch<C extends Command>(
  registry: CqrsRegistry,
  command: C,
): Promise<CommandResult> {
  const handler = registry.commands.get(command.type);
  if (!handler) {
    return {
      ok: false,
      error: `No handler registered for command "${command.type}"`,
    };
  }
  try {
    return await handler(command);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Dispatch a query to its registered handler. Returns an error result
 * when no handler is registered for the query type.
 */
export async function query<Q extends Query, R = unknown>(
  registry: CqrsRegistry,
  q: Q,
): Promise<QueryResult<R>> {
  const handler = registry.queries.get(q.type);
  if (!handler) {
    return {
      ok: false,
      error: `No handler registered for query "${q.type}"`,
    };
  }
  try {
    return (await handler(q)) as QueryResult<R>;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Returns the list of registered command types. Useful for diagnostics
 * and assert-that-handler-registered smoke checks.
 */
export function listCommandTypes(registry: CqrsRegistry): CommandType[] {
  return [...registry.commands.keys()];
}

/**
 * Returns the list of registered query types.
 */
export function listQueryTypes(registry: CqrsRegistry): QueryType[] {
  return [...registry.queries.keys()];
}
