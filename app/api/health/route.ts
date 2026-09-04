/**
 * Health check — lightweight, unauthenticated probe used by deployment
 * smoke-tests and uptime monitors.
 *
 * Returns a 200 with `{ status, timestamp, version }`. The endpoint performs
 * no database or auth work so it stays cheap even when the rest of the
 * application is degraded. Deployment tooling that needs to assert D1
 * connectivity should hit `/api/workspace` (auth-gated) instead.
 */

const APP_VERSION = "0.1.0";

export async function GET() {
  return Response.json({
    status: "healthy",
    timestamp: Date.now(),
    version: APP_VERSION,
  });
}
