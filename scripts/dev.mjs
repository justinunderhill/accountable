// `npm run dev`: installs anything missing, starts the API and the web app, and
// stops both on Ctrl+C. Node built-ins only, so it runs before `npm install`.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const apiPort = process.env.ACCOUNTABLE_API_PORT ?? "8000";
const webPort = process.env.ACCOUNTABLE_WEB_PORT ?? "5173";
const env = { ...process.env, ACCOUNTABLE_API_PORT: apiPort, ACCOUNTABLE_WEB_PORT: webPort };

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function checkPrerequisites() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 24) fail(`Accountable needs Node 24 or later. This is Node ${process.versions.node}.`);
  const uv = spawnSync("uv", ["--version"], { stdio: "ignore" });
  if (uv.error || uv.status !== 0) {
    fail("Accountable needs uv for its Python backend. Install it from https://docs.astral.sh/uv/ and try again.");
  }
}

// Written after each successful install. Any package file newer than it means
// packages were added or changed since, for example by a `git pull`.
const INSTALL_MARKER = join(root, "node_modules", ".accountable-installed");
const PACKAGE_FILES = ["package.json", "package-lock.json", join("frontend", "package.json")].map((f) => join(root, f));

function needsInstall() {
  if (!existsSync(join(root, "node_modules", "vite", "bin", "vite.js")) || !existsSync(INSTALL_MARKER)) return true;
  const installed = statSync(INSTALL_MARKER).mtimeMs;
  return PACKAGE_FILES.some((file) => existsSync(file) && statSync(file).mtimeMs > installed);
}

function installIfMissing() {
  if (needsInstall()) {
    console.log("Installing the web app's packages...");
    // npm is a .cmd script on Windows, which needs a shell to run.
    const result = spawnSync("npm", ["install"], { cwd: root, stdio: "inherit", shell: isWindows });
    if (result.status !== 0) fail("npm install failed. Check the messages above.");
    writeFileSync(INSTALL_MARKER, new Date().toISOString());
  }
  console.log("Checking the backend's packages...");
  const sync = spawnSync("uv", ["sync"], { cwd: root, stdio: "inherit" });
  if (sync.status !== 0) fail("uv sync failed. Check the messages above.");
}

const children = [];
let stopping = false;

function start(name, command, args, cwd) {
  // No shell, so the process we hold is the server itself (or uv, which owns it).
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "inherit", "inherit"] });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`\nThe ${name} stopped unexpectedly (exit code ${code}). Stopping Accountable.`);
      stop(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

function killTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (isWindows) {
    // Ctrl+C doesn't always reach grandchildren on Windows, which leaves the port taken.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) killTree(child);
  process.exit(code);
}

async function waitFor(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

checkPrerequisites();
installIfMissing();

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
process.on("SIGHUP", () => stop(0));

start(
  "API",
  "uv",
  ["run", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", apiPort, "--no-access-log"],
  root,
);
start("web app", process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js")], join(root, "frontend"));

const [apiUp, webUp] = await Promise.all([
  waitFor(`http://127.0.0.1:${apiPort}/api/health`),
  waitFor(`http://localhost:${webPort}/`),
]);
if (!apiUp || !webUp) {
  console.error(`\nAccountable didn't start: the ${apiUp ? "web app" : "API"} isn't answering.`);
  stop(1);
} else {
  console.log(`\n  Accountable is running. Open http://localhost:${webPort} in Chrome.`);
  console.log("  Press Ctrl+C to stop.\n");
}
