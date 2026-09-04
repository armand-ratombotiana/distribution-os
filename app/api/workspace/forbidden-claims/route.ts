import { z } from "zod";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";
import {
  addForbiddenClaim,
  getOrCreateSettings,
  parseForbiddenClaims,
  removeForbiddenClaim,
} from "../../../../db/workspace-settings";
import { logAuditEvent } from "../../../../db/audit";

const claimSchema = z.object({
  claim: z.string().trim().min(1).max(500),
});

/**
 * Forbidden-claims blocklist — the brand-safety list of marketing claims
 * that AI-generated content must never make (e.g. "cure", "FDA-approved",
 * "guaranteed return").
 *
 * GET    — list every claim on the blocklist.
 * POST   — add a claim to the blocklist (case-insensitive dedupe).
 * DELETE — remove a claim from the blocklist (case-insensitive match).
 *
 * The blocklist is persisted as a JSON array on the `workspace_settings`
 * row, so the settings row is created on demand when it does not yet exist.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const settings = await getOrCreateSettings(workspace.id);
    return Response.json({
      claims: parseForbiddenClaims(settings.forbidden_claims_json),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view forbidden claims." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Forbidden claims unavailable.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const input = claimSchema.parse(await request.json());
    const settings = await addForbiddenClaim(workspace.id, input.claim);

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "config",
        event_type: "forbidden_claim.added",
        resource_type: "workspace_settings",
        resource_id: workspace.id,
        detail: { claim: input.claim },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(
      { claims: parseForbiddenClaims(settings.forbidden_claims_json) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to manage forbidden claims." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid forbidden claim." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Forbidden claim could not be added.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const url = new URL(request.url);
    const claimParam = url.searchParams.get("claim");
    const bodyClaim = await safeReadBodyClaim(request);
    const claim = (claimParam ?? bodyClaim)?.trim();
    if (!claim) {
      return Response.json(
        { error: "Provide a `claim` query param or JSON body." },
        { status: 400 },
      );
    }
    if (claim.length > 500) {
      return Response.json(
        { error: "Forbidden claim is too long." },
        { status: 400 },
      );
    }

    const settings = await removeForbiddenClaim(workspace.id, claim);

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "config",
        event_type: "forbidden_claim.removed",
        resource_type: "workspace_settings",
        resource_id: workspace.id,
        detail: { claim },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({
      claims: parseForbiddenClaims(settings.forbidden_claims_json),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to manage forbidden claims." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Forbidden claim could not be removed.",
      },
      { status: 500 },
    );
  }
}

/**
 * Best-effort parse of a JSON body of the form `{ "claim": string }`.
 * Returns `null` when the body is missing, malformed, or does not contain a
 * `claim` string — the caller falls back to the query param.
 */
async function safeReadBodyClaim(request: Request): Promise<string | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as { claim?: unknown }).claim === "string"
    ) {
      return (parsed as { claim: string }).claim;
    }
  } catch {
    /* fall through */
  }
  return null;
}
