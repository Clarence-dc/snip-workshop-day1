import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = path.join(root, "bundle");
const frontend = path.join(root, "frontend");
const output = path.join(frontend, "dist", "snip-frontend", "browser");
const publicDir = path.join(bundle, "public");
const shouldPush = process.argv.slice(2).includes("--push");
const generatedFiles = [
  ".dockerignore", ".env", "Dockerfile", "cli.js", "package.json",
  "public", "railway.json", "server.js", "source-revisions.json",
];

function run(command, args, cwd, { capture = false } = {}) {
  const isWindowsPackageCommand =
    process.platform === "win32" && (command === "npm" || command === "npx");
  const executable = isWindowsPackageCommand ? process.env.ComSpec ?? "cmd.exe" : command;
  const executableArgs = isWindowsPackageCommand
    ? ["/d", "/c", `${command} ${args.join(" ")}`]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = capture ? result.stderr.trim() : "";
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}${details ? `: ${details}` : ""}`,
    );
  }

  return capture ? result.stdout.trim() : "";
}

function hasStagedChanges(cwd) {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd,
    stdio: "ignore",
  });
  if (result.status === 1) return true;
  if (result.status !== 0) {
    throw new Error(`Could not inspect staged changes in ${cwd}`);
  }
  return false;
}

function commitStagedChanges(cwd, message) {
  if (!hasStagedChanges(cwd)) {
    console.log(`No changes to commit in ${path.relative(root, cwd) || "."}.`);
    return false;
  }
  const commitMessage = [
    message,
    "",
    "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
    "Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>",
  ].join("\n");
  run("git", ["commit", "-m", commitMessage], cwd);
  return true;
}

const currentBranch = run("git", ["branch", "--show-current"], root, {
  capture: true,
});
if (currentBranch !== "main") {
  throw new Error(`Run this script from main, not ${currentBranch || "detached HEAD"}.`);
}
if (hasStagedChanges(root) || run("git", ["status", "--porcelain"], bundle, { capture: true })) {
  throw new Error("Unrelated staged changes or a dirty bundle must be resolved before building.");
}

run("git", ["submodule", "update", "--init", "--remote", "backend", "frontend", "cli"], root);
run("npm", ["ci"], frontend);
run("npm", ["audit", "--omit=dev"], frontend);
run("npm", ["audit", "--audit-level=high"], frontend);
run("npx", ["ng", "test", "--watch=false", "--browsers=ChromeHeadless"], frontend);
run("npx", ["ng", "build"], frontend);

try {
  await readFile(path.join(output, "index.html"));
} catch {
  throw new Error(`Angular build output is missing: ${path.join(output, "index.html")}`);
}

await mkdir(bundle, { recursive: true });
await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(path.join(frontend, "dist", "snip-frontend", "browser"), publicDir, {
  recursive: true,
});
await cp(path.join(root, "backend", "server.js"), path.join(bundle, "server.js"));
await cp(path.join(root, "cli", "cli.js"), path.join(bundle, "cli.js"));
const revisions = {};
for (const name of ["backend", "frontend", "cli"]) {
  revisions[name] = run("git", ["rev-parse", "HEAD"], path.join(root, name), {
    capture: true,
  });
}
await writeFile(
  path.join(bundle, "source-revisions.json"),
  `${JSON.stringify(revisions, null, 2)}\n`,
);

await writeFile(path.join(bundle, ".env"), "PUBLIC_DIR=./public\n");
await writeFile(
  path.join(bundle, "package.json"),
  `${JSON.stringify(
    {
      name: "snip-bundle",
      version: "1.0.0",
      private: true,
      scripts: { start: "bun server.js" },
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  path.join(bundle, "Dockerfile"),
  [
    "FROM oven/bun:1-alpine",
    "RUN apk upgrade --no-cache && apk add --no-cache 'zlib>=1.4-r0'",
    "WORKDIR /app",
    "COPY . .",
    "ENV PORT=3000",
    "EXPOSE 3000",
    'CMD ["bun", "server.js"]',
    "",
  ].join("\n"),
);
await writeFile(
  path.join(bundle, ".dockerignore"),
  [".git", ".gitignore", "node_modules", "npm-debug.log*", ".DS_Store", ""].join("\n"),
);
await writeFile(
  path.join(bundle, "railway.json"),
  `${JSON.stringify(
    {
      "$schema": "https://railway.app/railway.schema.json",
      build: { builder: "DOCKERFILE" },
    },
    null,
    2,
  )}\n`,
);

run("git", ["add", "-A", "--", ...generatedFiles], bundle);
commitStagedChanges(bundle, "Build generated Snip bundle");

run("git", ["add", "backend", "frontend", "cli", "bundle"], root);
commitStagedChanges(root, "Update Snip source and bundle submodule pointers");

if (shouldPush) {
  run("git", ["push", "origin", "HEAD:refs/heads/bundle"], bundle);
  run("git", ["push", "origin", "main"], root);
}

console.log("Snip bundle is assembled.");
