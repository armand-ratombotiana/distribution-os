import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeEnv = typeof env & { DB?: D1Database };

function runtimeEnv(): RuntimeEnv {
  return env as RuntimeEnv;
}

export function getDb() {
  const runtime = runtimeEnv();
  if (!runtime.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(runtime.DB, { schema });
}

export function getRawDb() {
  const runtime = runtimeEnv();
  if (!runtime.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`."
    );
  }

  return runtime.DB;
}
