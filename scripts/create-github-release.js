#!/usr/bin/env node
/**
 * Create one aggregated GitHub Release for a publish batch.
 *
 * npm may publish many packages (lerna dependency propagation). This script
 * creates a single GitHub Release with only substantive changes:
 * - skips packages whose diff is version metadata only
 * - skips bump-only changelog sections
 * - syncs seekdb into notes when @seekdb/js-bindings has substantive changes
 *
 * Aggregate tag prefers seekdb version (customer-facing), else highest included.
 *
 * Usage:
 *   node scripts/create-github-release.js [--tag v1.3.1] [--commit HEAD] [--dry-run]
 *
 * Run after `pnpm run publish` (package tags on the release commit).
 * --dry-run without package tags at HEAD previews from `lerna changed`.
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
    .filter((tag) => !tag.startsWith("v") && tag.includes("@"));
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

function latestPackageTag(name) {
  return (
    run(`git tag -l ${JSON.stringify(`${name}@*`)} --sort=-v:refname`)
      .split("\n")
      .filter(Boolean)[0] || null
  );
}

function commitsSinceRef(dir, fromRef, toRef) {
  const relDir = path.relative(root, dir);
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  return run(`git log ${range} --format=%s -- ${JSON.stringify(relDir)}`)
    .split("\n")
    .filter(Boolean);
}

function hasSubstantiveSinceRef(dir, fromRef, toRef) {
  const relDir = path.relative(root, dir);
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  const diff = run(
    `git diff --name-only ${range} -- ${JSON.stringify(relDir)}`
  );
  const changedFiles = diff.split("\n").filter(Boolean);
  if (changedFiles.length === 0) return false;
  return changedFiles.some((file) => !META_FILES.has(path.basename(file)));
}

function bumpFromSubject(subject) {
  const match = subject.match(/^(\w+)(?:\([^)]*\))?(!)?:\s/);
  if (!match) return "patch";
  const [, type, breaking] = match;
  if (breaking) return "major";
  if (type === "feat") return "minor";
  if (["fix", "perf", "revert"].includes(type)) return "patch";
  return null;
}

function suggestBumpFromCommits(commits) {
  const rank = { patch: 1, minor: 2, major: 3 };
  let bump = null;
  for (const subject of commits) {
    const commitBump = bumpFromSubject(subject);
    if (!commitBump) continue;
    if (!bump || rank[commitBump] > rank[bump]) bump = commitBump;
  }
  return bump || "patch";
}

function bumpSemver(version, bump) {
  const parts = version.split(".").map(Number);
  if (bump === "major") return `${parts[0] + 1}.0.0`;
  if (bump === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function changedPackagesFromLerna() {
  try {
    return run("npx lerna changed -l --toposort")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(.+?)\s+v([\d.]+)\s+(\S+)$/);
        if (!match) return null;
        return {
          name: match[1].trim(),
          version: match[2],
          dir: path.join(root, match[3]),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function projectNextVersion(name, dir, currentVersion, toRef) {
  const previousTag = latestPackageTag(name);
  const commits = commitsSinceRef(dir, previousTag, toRef);
  return bumpSemver(currentVersion, suggestBumpFromCommits(commits));
}

function fallbackSectionSinceRef(dir, fromRef, toRef) {
  const commits = commitsSinceRef(dir, fromRef, toRef);
  if (commits.length === 0) return "_No changelog entry._";
  return commits.map((subject) => `- ${subject}`).join("\n");
}

function shouldIncludePlanned({ dir, name, toRef }) {
  const previousTag = latestPackageTag(name);
  if (hasSubstantiveSinceRef(dir, previousTag, toRef)) {
    return { include: true };
  }
  return { include: false, reason: "version-only diff" };
}

function buildPlannedRelease(args) {
  const toRef = args.commit;
  const planned = changedPackagesFromLerna();
  if (planned.length === 0) {
    console.log("No packages changed (lerna changed is empty).");
    return null;
  }

  console.log(
    `No package tags at ${toRef}; previewing planned release from lerna changed.\n`
  );

  const taggedAtCommit = new Map();
  for (const pkg of planned) {
    const nextVersion = projectNextVersion(
      pkg.name,
      pkg.dir,
      pkg.version,
      toRef
    );
    taggedAtCommit.set(pkg.name, {
      tag: `${pkg.name}@${nextVersion}`,
      name: pkg.name,
      version: nextVersion,
      dir: pkg.dir,
      currentVersion: pkg.version,
    });
  }

  return collectReleaseEntries(taggedAtCommit, { planned: true, toRef });
}

function collectReleaseEntries(
  taggedAtCommit,
  { planned = false, toRef } = {}
) {
  const entries = [];
  const bindingsTagged = taggedAtCommit.get("@seekdb/js-bindings");
  let bindingsVersion = null;

  if (bindingsTagged) {
    const bindingsSection = planned
      ? null
      : extractChangelogSection(
          path.join(bindingsTagged.dir, "CHANGELOG.md"),
          bindingsTagged.version
        );
    const bindingsCheck = planned
      ? shouldIncludePlanned({
          dir: bindingsTagged.dir,
          name: bindingsTagged.name,
          toRef,
        })
      : shouldIncludePackage({
          dir: bindingsTagged.dir,
          name: bindingsTagged.name,
          version: bindingsTagged.version,
          section: bindingsSection,
        });
    if (bindingsCheck.include) {
      bindingsVersion = bindingsTagged.version;
    }
  }

  for (const [, pkg] of taggedAtCommit) {
    const changelogPath = path.join(pkg.dir, "CHANGELOG.md");
    const section = planned
      ? null
      : extractChangelogSection(changelogPath, pkg.version);
    let { include, reason } = planned
      ? shouldIncludePlanned({ dir: pkg.dir, name: pkg.name, toRef })
      : shouldIncludePackage({
          dir: pkg.dir,
          name: pkg.name,
          version: pkg.version,
          section,
        });

    if (
      !include &&
      pkg.name === "seekdb" &&
      bindingsVersion &&
      taggedAtCommit.has("seekdb")
    ) {
      include = true;
      reason = "synced with @seekdb/js-bindings";
    }

    if (!include) {
      console.log(`skip (${reason}): ${pkg.tag}`);
      continue;
    }

    let entry;
    if (planned) {
      const previousTag = latestPackageTag(pkg.name);
      entry = {
        name: pkg.name,
        version: pkg.version,
        section:
          pkg.name === "seekdb" && bindingsVersion
            ? seekdbBindingsSyncNote(bindingsVersion)
            : fallbackSectionSinceRef(pkg.dir, previousTag, toRef),
      };
      console.log(
        `include: ${pkg.name}@${pkg.currentVersion} -> ${pkg.version} (planned)`
      );
    } else {
      entry = buildEntry({
        dir: pkg.dir,
        name: pkg.name,
        version: pkg.version,
        section,
        bindingsVersion: pkg.name === "seekdb" ? bindingsVersion : null,
      });
      console.log(`include: ${pkg.tag}`);
    }

    entries.push(entry);
  }

  return entries;
}

function shouldIncludePackage({ dir, name, version, section }) {
  if (section && !isBumpOnly(section)) {
    return { include: true };
  }
  if (hasSubstantivePackageChanges(dir, name, version)) {
    return { include: true };
  }
  return { include: false, reason: "version-only diff" };
}

function seekdbBindingsSyncNote(bindingsVersion) {
  return [
    "### Features",
    "",
    `- Embedded Mode: upgraded @seekdb/js-bindings@${bindingsVersion} for libseekdb compatibility.`,
  ].join("\n");
}

function buildEntry({ dir, name, version, section, bindingsVersion }) {
  if (section && !isBumpOnly(section)) {
    return { name, version, section };
  }
  if (name === "seekdb" && bindingsVersion) {
    return {
      name,
      version,
      section: seekdbBindingsSyncNote(bindingsVersion),
    };
  }
  return {
    name,
    version,
    section: fallbackSection(dir, name, version),
  };
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
  const seekdb = entries.find((e) => e.name === "seekdb");
  if (seekdb) return `v${seekdb.version}`;
  const versions = entries.map((e) => e.version).sort(compareSemver);
  return `v${versions[versions.length - 1]}`;
}

const RELEASE_NOTE_ORDER = ["seekdb", "@seekdb/js-bindings"];

function sortReleaseEntries(entries) {
  return [...entries].sort((a, b) => {
    const aRank = RELEASE_NOTE_ORDER.indexOf(a.name);
    const bRank = RELEASE_NOTE_ORDER.indexOf(b.name);
    const aOrder = aRank === -1 ? RELEASE_NOTE_ORDER.length : aRank;
    const bOrder = bRank === -1 ? RELEASE_NOTE_ORDER.length : bRank;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

function buildReleaseNotes(entries) {
  return sortReleaseEntries(entries)
    .map(({ name, version, section }) => {
      return `## ${name}@${version}\n\n${section}`;
    })
    .join("\n\n");
}

function main() {
  const args = parseArgs(process.argv);
  const packages = packageByName();
  const tags = packageTagsAtCommit(args.commit);

  let entries = null;
  let planned = false;

  if (tags.length === 0) {
    if (args.dryRun) {
      entries = buildPlannedRelease(args);
      planned = true;
      if (!entries || entries.length === 0) {
        process.exit(0);
      }
    } else {
      console.error(
        `No package tags (name@version) found at commit ${args.commit}.`
      );
      console.error(
        "Run after lerna version / manual package tag on that commit."
      );
      process.exit(1);
    }
  } else {
    const taggedAtCommit = new Map();
    for (const tag of tags) {
      const parsed = parseVersionFromTag(tag);
      if (!parsed) continue;
      const info = packages.get(parsed.name);
      if (!info) continue;
      taggedAtCommit.set(parsed.name, { tag, ...parsed, ...info });
    }
    entries = collectReleaseEntries(taggedAtCommit, { toRef: args.commit });
  }

  if (!entries || entries.length === 0) {
    console.error("No packages with substantive changelog entries to release.");
    process.exit(args.dryRun ? 0 : 1);
  }

  const releaseTag = pickAggregateTag(entries, args.tag);
  const title = releaseTag;
  const notes = buildReleaseNotes(entries);

  console.log(`\nRelease tag: ${releaseTag}`);
  console.log(`Title: ${title}`);
  if (planned) {
    console.log(
      "Note: planned preview; exact versions follow lerna version/publish."
    );
  }
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
