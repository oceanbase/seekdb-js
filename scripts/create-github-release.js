#!/usr/bin/env node
/**
 * Create one aggregated GitHub Release for a publish batch.
 *
 * Reads package tags on the release commit, extracts each package's latest
 * CHANGELOG section, and skips packages whose diff is version metadata only
 * (package.json / CHANGELOG.md) or whose changelog is bump-only.
 *
 * Usage:
 *   node scripts/create-github-release.js [--tag v1.3.1] [--commit HEAD] [--dry-run]
 *
 * Requires: gh CLI, GH_TOKEN (or gh auth login)
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const { packages: packageGlobs } = require("../lerna.json");

const META_FILES = new Set([
  "package.json",
  "CHANGELOG.md",
  "package-lock.json",
  "pnpm-lock.yaml",
]);

const BUMP_ONLY = /version bump only/i;

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, encoding: "utf8", ...opts }).trim();
}

function parseArgs(argv) {
  const args = { dryRun: false, commit: "HEAD", tag: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--commit") args.commit = argv[++i];
    else if (argv[i] === "--tag") args.tag = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

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

function packageByName() {
  const map = new Map();
  for (const dir of listPackageDirs()) {
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (!pkg.private) map.set(pkg.name, { dir, pkg });
  }
  return map;
}

function packageTagsAtCommit(commit) {
  return run(`git tag --points-at ${commit}`)
    .split("\n")
    .filter(Boolean)
    .filter((tag) => tag.includes("@"));
}

function parseVersionFromTag(tag) {
  const at = tag.lastIndexOf("@");
  if (at === -1) return null;
  return { name: tag.slice(0, at), version: tag.slice(at + 1) };
}

function extractChangelogSection(changelogPath, version) {
  if (!fs.existsSync(changelogPath)) return null;
  const text = fs.readFileSync(changelogPath, "utf8");
  const heading = new RegExp(`^## ${version.replace(/\./g, "\\.")}\\s*$`, "m");
  const match = heading.exec(text);
  if (!match) return null;

  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const next = rest.search(/^## \d+\.\d+/m);
  const body = (next === -1 ? rest : rest.slice(0, next)).trim();
  return body || null;
}

function previousPackageTag(name, version) {
  const tags = run(
    `git tag -l ${JSON.stringify(`${name}@*`)} --sort=-v:refname`
  )
    .split("\n")
    .filter(Boolean);
  const current = `${name}@${version}`;
  const index = tags.indexOf(current);
  if (index === -1 || index === tags.length - 1) return null;
  return tags[index + 1];
}

function hasSubstantivePackageChanges(dir, name, version) {
  const currentTag = `${name}@${version}`;
  const previousTag = previousPackageTag(name, version);
  if (!previousTag) return true;

  const relDir = path.relative(root, dir);
  const diff = run(
    `git diff --name-only ${JSON.stringify(previousTag)}..${JSON.stringify(currentTag)} -- ${JSON.stringify(relDir)}`
  );
  const changedFiles = diff.split("\n").filter(Boolean);
  if (changedFiles.length === 0) return false;

  return changedFiles.some((file) => !META_FILES.has(path.basename(file)));
}

function isBumpOnly(section) {
  if (!section) return true;
  if (BUMP_ONLY.test(section)) return true;
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("###"));
  return lines.length === 0;
}

function shouldIncludePackage({ dir, name, version, section }) {
  if (section && !isBumpOnly(section)) {
    return { include: true };
  }
  if (hasSubstantivePackageChanges(dir, name, version)) {
    return { include: true };
  }
  if (name === "seekdb" && section) {
    return { include: true };
  }
  return { include: false, reason: "version-only diff" };
}

function fallbackSection(dir, name, version) {
  const currentTag = `${name}@${version}`;
  const previousTag = previousPackageTag(name, version);
  const relDir = path.relative(root, dir);
  const range = previousTag
    ? `${JSON.stringify(previousTag)}..${JSON.stringify(currentTag)}`
    : JSON.stringify(currentTag);
  const commits = run(
    `git log ${range} --format=%s -- ${JSON.stringify(relDir)}`
  )
    .split("\n")
    .filter(Boolean);
  if (commits.length === 0) return "_No changelog entry._";
  return commits.map((subject) => `- ${subject}`).join("\n");
}

function compareSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function pickAggregateTag(entries, explicitTag) {
  if (explicitTag)
    return explicitTag.startsWith("v") ? explicitTag : `v${explicitTag}`;
  const versions = entries.map((e) => e.version).sort(compareSemver);
  const highest = versions[versions.length - 1];
  return `v${highest}`;
}

function buildReleaseNotes(entries) {
  return entries
    .map(({ name, version, section }) => {
      return `## ${name}@${version}\n\n${section}`;
    })
    .join("\n\n");
}

function main() {
  const args = parseArgs(process.argv);
  const packages = packageByName();
  const tags = packageTagsAtCommit(args.commit);

  if (tags.length === 0) {
    console.error(
      `No package tags (name@version) found at commit ${args.commit}.`
    );
    console.error(
      "Run after lerna version / manual package tag on that commit."
    );
    process.exit(1);
  }

  const entries = [];
  for (const tag of tags) {
    const parsed = parseVersionFromTag(tag);
    if (!parsed) continue;
    const info = packages.get(parsed.name);
    if (!info) continue;

    const changelogPath = path.join(info.dir, "CHANGELOG.md");
    const section = extractChangelogSection(changelogPath, parsed.version);
    const { include, reason } = shouldIncludePackage({
      dir: info.dir,
      name: parsed.name,
      version: parsed.version,
      section,
    });
    if (!include) {
      console.log(`skip (${reason}): ${tag}`);
      continue;
    }
    let notes;
    if (section && !isBumpOnly(section)) {
      notes = section;
    } else if (parsed.name === "seekdb") {
      const bindingsVersion = tags
        .map(parseVersionFromTag)
        .find((t) => t?.name === "@seekdb/js-bindings")?.version;
      notes = [
        "### Features",
        "",
        `- Embedded Mode: upgraded @seekdb/js-bindings@${bindingsVersion ?? parsed.version} for libseekdb compatibility.`,
      ].join("\n");
    } else {
      notes = fallbackSection(info.dir, parsed.name, parsed.version);
    }
    entries.push({
      name: parsed.name,
      version: parsed.version,
      section: notes,
    });
    console.log(`include: ${tag}`);
  }

  if (entries.length === 0) {
    console.error("No packages with substantive changelog entries to release.");
    process.exit(1);
  }

  const releaseTag = pickAggregateTag(entries, args.tag);
  const title = releaseTag;
  const notes = buildReleaseNotes(entries);

  console.log(`\nRelease tag: ${releaseTag}`);
  console.log(`Title: ${title}`);
  console.log("--- notes ---\n");
  console.log(notes);
  console.log("--- end ---\n");

  if (args.dryRun) {
    console.log("(dry-run) skipped gh release create");
    return;
  }

  const hasTag = run(`git tag -l ${releaseTag}`);
  if (!hasTag) {
    run(`git tag ${releaseTag} ${args.commit}`, { stdio: "inherit" });
    console.log(`created tag ${releaseTag} at ${args.commit}`);
  }

  const notesFile = path.join(
    root,
    ".changelog",
    "aggregated-release-notes.md"
  );
  fs.mkdirSync(path.dirname(notesFile), { recursive: true });
  fs.writeFileSync(notesFile, `${notes}\n`);

  try {
    run(`gh release view ${releaseTag}`, { stdio: "pipe" });
    console.log(`release ${releaseTag} already exists, updating notes`);
    run(
      `gh release edit ${releaseTag} --title ${JSON.stringify(title)} --notes-file ${JSON.stringify(notesFile)}`,
      { stdio: "inherit" }
    );
  } catch {
    run(
      `gh release create ${releaseTag} --title ${JSON.stringify(title)} --notes-file ${JSON.stringify(notesFile)}`,
      { stdio: "inherit" }
    );
  }

  console.log(
    `\nDone: https://github.com/oceanbase/seekdb-js/releases/tag/${encodeURIComponent(releaseTag)}`
  );
}

main();
