#!/usr/bin/env node
/**
 * Release wrapper: forwards bump to lerna version, then publish from-git + GitHub Release.
 *
 * Usage:
 *   pnpm run publish
 *   pnpm run publish -- minor
 *   pnpm run publish -- 1.4.0
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

const bump = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
const versionCmd = bump ? `npx lerna version ${bump}` : "npx lerna version";

run(versionCmd);
run("npx lerna publish from-git");
run("node scripts/create-github-release.js");
