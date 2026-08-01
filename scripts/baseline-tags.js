#!/usr/bin/env node
/**
 * One-time migration helper: align Lerna independent tags (name@version)
 * with each package's current version and remove legacy bare semver tags.
 *
 * Usage: node scripts/baseline-tags.js [--dry-run]
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const { packages: packageGlobs } = require("../lerna.json");

const RELEASE_COMMITS_BY_VERSION = {
  "1.2.0": "efab79b",
  "1.3.0": "1efc691",
};

const LEGACY_BARE_TAGS = ["1.1.0", "1.1.1", "1.2.0", "1.3.0"];

function listPackageDirs() {
  const dirs = [];
  for (const pattern of packageGlobs) {
    const full = path.join(root, pattern);
    if (pattern.endsWith("/*")) {
      const parent = path.dirname(full);
      for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(path.join(parent, entry.name));
      }
    } else if (fs.existsSync(full)) {
      dirs.push(full);
    }
  }
  return dirs;
}

function resolveReleaseCommit(version) {
  if (RELEASE_COMMITS_BY_VERSION[version]) {
    return RELEASE_COMMITS_BY_VERSION[version];
  }
  const output = execSync(
    `git log -1 --format=%H --grep="release v${version}"`,
    {
      cwd: root,
      encoding: "utf8",
    }
  ).trim();
  if (!output)
    throw new Error(`Could not resolve release commit for version ${version}`);
  return output;
}

const existingTags = new Set(
  execSync("git tag -l", { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
);

let created = 0;
let updated = 0;
let skipped = 0;

for (const tag of LEGACY_BARE_TAGS) {
  if (!existingTags.has(tag)) continue;
  if (dryRun) console.log(`would remove legacy tag: ${tag}`);
  else {
    execSync(`git tag -d "${tag}"`, { cwd: root, stdio: "inherit" });
    console.log(`removed legacy tag: ${tag}`);
    existingTags.delete(tag);
  }
}

for (const dir of listPackageDirs()) {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.private) continue;

  const tag = `${pkg.name}@${pkg.version}`;
  const commit = resolveReleaseCommit(pkg.version);
  const currentTarget = existingTags.has(tag)
    ? execSync(`git rev-parse ${tag}^{commit}`, {
        cwd: root,
        encoding: "utf8",
      }).trim()
    : null;

  if (currentTarget === commit) {
    console.log(`skip (correct): ${tag} -> ${commit.slice(0, 7)}`);
    skipped++;
    continue;
  }

  const action = existingTags.has(tag) ? "update" : "create";
  if (dryRun) {
    console.log(`would ${action}: ${tag} -> ${commit.slice(0, 7)}`);
    action === "create" ? created++ : updated++;
    continue;
  }

  execSync(`git tag -f "${tag}" ${commit}`, { cwd: root, stdio: "inherit" });
  console.log(`${action}d: ${tag} -> ${commit.slice(0, 7)}`);
  action === "create" ? created++ : updated++;
}

console.log(
  `\nDone. created=${created}, updated=${updated}, skipped=${skipped}${dryRun ? " (dry-run)" : ""}`
);
