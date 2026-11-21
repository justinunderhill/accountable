// `npm test`: runs every test suite, even after one fails, then prints a summary
// and exits with an error if any suite failed. Node built-ins only.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const suites = [
  { name: "Backend unit tests (pytest)", command: "npm run test:backend" },
  { name: "Frontend unit tests (Vitest)", command: "npm run test:frontend" },
  { name: "End-to-end tests (Playwright, Chrome)", command: "npm run test:e2e" },
];

const results = [];
for (const suite of suites) {
  console.log(`\n=== ${suite.name} ===\n`);
  const started = Date.now();
  // A shell, so npm's .cmd launcher works on Windows as well as Mac and Linux.
  const run = spawnSync(suite.command, { cwd: root, stdio: "inherit", shell: true });
  results.push({ ...suite, ok: run.status === 0, seconds: ((Date.now() - started) / 1000).toFixed(1) });
}

console.log("\n=== Summary ===\n");
for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name} (${r.seconds}s)`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} suites failed.\n` : "\nAll suites passed.\n");
process.exit(failed.length ? 1 : 0);
