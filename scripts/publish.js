#!/usr/bin/env node
/**
 * Release wrapper: forwards bump to lerna version, then publish from-git + GitHub Release.
 *
 * Usage:
 *   pnpm run publish
 *   pnpm run publish -- minor
 *   pnpm run publish -- 1.4.0
 *   pnpm run publish -- 1.4.0 --yes
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

// Root package.json defines a "publish" script for `pnpm run publish`. Lerna also
// runs the root publish lifecycle after npm publish; skip that recursive invocation.
if (process.env.SEEKDB_PUBLISH_ENTRY !== "1") {
  process.exit(0);
}

function run(cmd, opts = {}) {
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, npm_lifecycle_event: "publish", ...opts.env },
  });
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const bump = args.find((arg) => !arg.startsWith("-"));
const yesFlag = args.includes("-y") || args.includes("--yes") ? " --yes" : "";
const versionCmd = bump
  ? `npx lerna version ${bump}${yesFlag}`
  : `npx lerna version${yesFlag}`;

run(versionCmd);
run(`npx lerna publish from-git${yesFlag}`);
run("node scripts/create-github-release.js");
