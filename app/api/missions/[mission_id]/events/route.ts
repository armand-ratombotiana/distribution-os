import { getRawDb } from "../../../../../db/index";
import { getMission } from "../../../../../db/missions";
import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

type MissionEventRow = {
  id: number;
  event_type: string;
  title: string;
  detail: string;
  actor: string;
  created_at: number;
};

const POLL_INTERVAL_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Server-Sent Events stream of mission events.
 *
 * The connection stays open and polls `mission_events` every 3 seconds for
 * rows newer than the last-emitted id. A `: heartbeat` comment is sent every
 * 15 seconds to keep the connection alive through proxies that close idle
 * sockets. The stream terminates when the client disconnects (the
 * `ReadableStream` cancel callback clears the polling timer).
 *
 * The hosting control plane injects identity headers into the EventSource
 * request. Every initial request and polling query is scoped to the caller's
 * workspace; a mission id is never treated as an authorization capability.
 */
export async function GET(request: Request, context: RouteContext) {
  const { mission_id } = await context.params;
  let workspaceId: string;
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    workspaceId = workspace.id;
    if (!(await getMission(mission_id, workspaceId))) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to stream mission events." }, { status: 401 });
    }
    return Response.json({ error: "Mission event stream unavailable." }, { status: 500 });
  }
  const encoder = new TextEncoder();

  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastEventId = 0;
      let lastHeartbeatAt = Date.now();
      let closed = false;

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const poll = async () => {
        if (closed) return;
        try {
          const db = getRawDb();
          const result = await db
            .prepare(
              "SELECT e.id, e.event_type, e.title, e.detail, e.actor, e.created_at FROM mission_events e JOIN missions m ON m.id = e.mission_id WHERE e.mission_id = ? AND m.workspace_id = ? AND e.id > ? ORDER BY e.id ASC LIMIT 100",
            )
            .bind(mission_id, workspaceId, lastEventId)
            .all<MissionEventRow>();

          for (const row of result.results) {
            const payload = {
              id: row.id,
              event_type: row.event_type,
              title: row.title,
              detail: row.detail,
              actor: row.actor,
              created_at: row.created_at,
            };
            enqueue(
              `id: ${row.id}\nevent: ${row.event_type}\ndata: ${JSON.stringify(payload)}\n\n`,
            );
            lastEventId = row.id;
          }
        } catch {
          // Swallow polling errors — the next tick will retry. Transient D1
          // hiccups should not tear down the SSE stream.
        }

        const now = Date.now();
        if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
          enqueue(`: heartbeat ${now}\n\n`);
          lastHeartbeatAt = now;
        }
      };

      // Send an initial comment so the client knows the stream is alive
      // before the first poll completes.
      enqueue(`: connected mission_id=${mission_id}\n\n`);

      interval = setInterval(poll, POLL_INTERVAL_MS);
      // Fire the first poll immediately so clients don't wait 3s for the
      // initial backlog.
      void poll();
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
