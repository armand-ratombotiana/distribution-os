import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runtimeRoot = process.env.SITES_RUNTIME_ROOT || join(projectRoot, ".sites-runtime");

for (const directory of ["npm-cache", "tmp", join("wrangler", "logs")]) {
  mkdirSync(join(runtimeRoot, directory), { recursive: true });
}

const commands = {
  dev: ["node_modules/vite/bin/vite.js"],
  build: ["node_modules/vinext/dist/cli.js", "build"],
  start: ["node_modules/vinext/dist/cli.js", "start"],
  lint: [
    "node_modules/eslint/bin/eslint.js",
    ".",
    "--ignore-pattern",
    "dist",
    "--ignore-pattern",
    ".next",
  ],
  "db:generate": ["node_modules/drizzle-kit/bin.cjs", "generate"],
};

const commandName = process.argv[2];
const command = commands[commandName];
if (!command) {
  console.error(`Unknown Sites command: ${commandName || "(missing)"}`);
  process.exit(64);
}

const timeoutMs = commandName === "build"
  ? Number(process.env.SITES_BUILD_TIMEOUT_MS || 180_000)
  : 0;

const child = spawn(process.execPath, command, {
  cwd: projectRoot,
  env: {
    ...process.env,
    NPM_CONFIG_CACHE: join(runtimeRoot, "npm-cache"),
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: join(runtimeRoot, "wrangler", "logs"),
    MINIFLARE_REGISTRY_PATH: join(runtimeRoot, "wrangler", "registry"),
  },
  stdio: "inherit",
});

const timer = timeoutMs > 0
  ? setTimeout(() => {
      console.error(`${commandName} exceeded ${timeoutMs}ms; terminating.`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, timeoutMs)
  : undefined;
timer?.unref();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  if (timer) clearTimeout(timer);
  console.error(error);
  process.exit(69);
});

child.on("exit", (code, signal) => {
  if (timer) clearTimeout(timer);
  if (signal) {
    console.error(`${commandName} terminated by ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
