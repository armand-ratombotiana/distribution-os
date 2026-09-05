import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const testsRoot = join(projectRoot, "tests");
const testFiles = readdirSync(testsRoot)
  .filter((name) => /\.test\.(?:mjs|ts)$/.test(name))
  .sort()
  .map((name) => join("tests", name));

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "--test", "--test-reporter=dot", ...testFiles],
  { cwd: projectRoot, stdio: "inherit" },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(69);
});
child.on("exit", (code) => process.exit(code ?? 1));
