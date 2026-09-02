#!/usr/bin/env node
/**
 * One-click release for customer-facing packages only:
 *   seekdb + @seekdb/js-bindings
 *
 * Usage:
 *   node scripts/publish-release.js [--dry-run] [--bump minor|patch|major|<version>]
 *   node scripts/publish-release.js --version-only [--no-push]
 *
 * Requires: npm login, gh CLI (for GitHub Release)
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const RELEASE_PACKAGES = [
  {
    name: "@seekdb/js-bindings",
    dir: "packages/bindings/pkgs/js-bindings",
  },
  {
    name: "seekdb",
    dir: "packages/seekdb",
  },
];

const META_FILES = new Set([
  "package.json",
  "CHANGELOG.md",
  "package-lock.json",
  "pnpm-lock.yaml",
]);

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: root,
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : "pipe",
    ...opts,
  });
}

function runInherit(cmd) {
  run(cmd, { inherit: true, encoding: undefined, stdio: "inherit" });
}

function runText(cmd) {
  return run(cmd).trim();
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    versionOnly: false,
    noPush: false,
    bump: "minor",
    force: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--version-only") args.versionOnly = true;
    else if (arg === "--no-push") args.noPush = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--bump") args.bump = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readPkg(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
}

function writePkg(dir, pkg) {
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`
  );
}

function latestTag(name) {
  return (
    runText(`git tag -l ${JSON.stringify(`${name}@*`)} --sort=-v:refname`)
      .split("\n")
      .filter(Boolean)[0] || null
  );
}

function hasSubstantiveSinceTag(dir, tag) {
  if (!tag) return true;
  const files = runText(
    `git diff --name-only ${JSON.stringify(tag)}..HEAD -- ${JSON.stringify(dir)}`
  )
    .split("\n")
    .filter(Boolean);
  return files.some((file) => !META_FILES.has(path.basename(file)));
}

function bumpSemver(version, bump) {
  if (/^\d+\.\d+\.\d+/.test(bump)) return bump;
  const parts = version.split(".").map(Number);
  if (bump === "major") {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (bump === "minor") {
    parts[1] += 1;
    parts[2] = 0;
  } else if (bump === "patch") {
    parts[2] += 1;
  } else {
    throw new Error(`Unsupported bump type: ${bump}`);
  }
  return parts.join(".");
}

function commitsSinceTag(dir, tag) {
  const range = tag ? `${JSON.stringify(tag)}..HEAD` : "HEAD";
  return runText(`git log ${range} --format=%s -- ${JSON.stringify(dir)}`)
    .split("\n")
    .filter(Boolean);
}

function prependChangelog(dir, version, body) {
  const changelogPath = path.join(dir, "CHANGELOG.md");
  const title = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8").split("\n")[0]
    : `# ${readPkg(dir).name}`;
  const section = `## ${version}\n\n${body.trim()}\n\n`;
  const rest = fs.existsSync(changelogPath)
    ? fs
        .readFileSync(changelogPath, "utf8")
        .slice(title.length)
        .replace(/^\n+/, "")
    : "";
  fs.writeFileSync(changelogPath, `${title}\n\n${section}${rest}`);
}

function buildChangelogBody(pkg, version, commits, bindingsVersion) {
  if (pkg.name === "seekdb" && commits.length === 0) {
    return [
      `Release date: ${new Date().toISOString().slice(0, 10)}`,
      `Version: V${version}`,
      "",
      "## New Features",
      "",
      `- **Embedded Mode**: Adapt to libseekdb via @seekdb/js-bindings@${bindingsVersion}.`,
    ].join("\n");
  }

  if (pkg.name === "seekdb") {
    return [
      `Release date: ${new Date().toISOString().slice(0, 10)}`,
      `Version: V${version}`,
      "",
      "## New Features",
      "",
      ...commits.map((subject) => `- ${subject}`),
    ].join("\n");
  }

  return ["### Features", "", ...commits.map((subject) => `- ${subject}`)].join(
    "\n"
  );
}

function npmVersion(name) {
  try {
    return runText(`npm view ${JSON.stringify(name)} version`);
  } catch {
    return null;
  }
}

function planRelease(args) {
  const explicitVersion = /^\d+\.\d+\.\d+$/.test(args.bump) ? args.bump : null;
  const bindingsPkg = RELEASE_PACKAGES[0];
  const bindingsTag = latestTag(bindingsPkg.name);
  const bindingsCurrent = readPkg(bindingsPkg.dir).version;
  const bindingsNext = explicitVersion
    ? explicitVersion
    : bumpSemver(bindingsCurrent, args.bump);

  const plans = [];
  let bindingsVersion = bindingsNext;

  for (const pkg of RELEASE_PACKAGES) {
    const current = readPkg(pkg.dir).version;
    const tag = latestTag(pkg.name);
    const next = explicitVersion
      ? explicitVersion
      : bumpSemver(current, args.bump);
    if (pkg.name === bindingsPkg.name) bindingsVersion = next;

    const substantive = hasSubstantiveSinceTag(pkg.dir, tag);
    const commits = commitsSinceTag(pkg.dir, tag);
    const changelogBody = buildChangelogBody(
      pkg,
      next,
      commits,
      bindingsVersion
    );

    plans.push({
      ...pkg,
      current,
      next,
      tag,
      substantive,
      commits,
      changelogBody,
    });
  }

  return plans;
}

function assertCanRelease(plans, args) {
  const bindings = plans[0];
  if (!bindings.substantive && !args.force) {
    throw new Error(
      "No substantive changes for @seekdb/js-bindings since last tag. Use --force to release anyway."
    );
  }

  for (const plan of plans) {
    const published = npmVersion(plan.name);
    if (published === plan.next) {
      throw new Error(`${plan.name}@${plan.next} is already published on npm.`);
    }
  }

  if (!args.dryRun && !args.versionOnly) {
    const dirty = runText("git status --porcelain");
    if (dirty) {
      throw new Error(
        "Working tree is not clean. Commit or stash changes first."
      );
    }
  }
}

function printPlan(plans, args) {
  console.log("=== publish-release plan ===\n");
  for (const plan of plans) {
    console.log(`${plan.name}: ${plan.current} -> ${plan.next}`);
    console.log(`  since tag: ${plan.tag ?? "(none)"}`);
    console.log(`  substantive: ${plan.substantive ? "yes" : "no"}`);
    console.log(
      `  commits: ${plan.commits.length ? plan.commits.join(" | ") : "(none)"}`
    );
    console.log("");
  }

  const aggregateTag = `v${
    plans
      .map((p) => p.next)
      .sort()
      .slice(-1)[0]
  }`;
  console.log(`npm publish: ${plans.map((p) => p.name).join(", ")}`);
  console.log(
    `git tags: ${plans.map((p) => `${p.name}@${p.next}`).join(", ")}`
  );
  console.log(`github release: ${aggregateTag}`);
  console.log(`push: ${args.noPush || args.dryRun ? "no" : "yes"}`);
  console.log("");
}

function applyVersionBump(plans) {
  for (const plan of plans) {
    const pkg = readPkg(plan.dir);
    pkg.version = plan.next;
    writePkg(plan.dir, pkg);
    prependChangelog(plan.dir, plan.next, plan.changelogBody);
  }
}

function commitAndTag(plans) {
  const names = plans.map((p) => `${p.name}@${p.next}`).join(" ");
  runInherit(`git add ${plans.map((p) => JSON.stringify(p.dir)).join(" ")}`);
  runInherit(
    `git commit -m ${JSON.stringify(`chore(release): publish ${names}`)}`
  );
  for (const plan of plans) {
    runInherit(`git tag ${JSON.stringify(`${plan.name}@${plan.next}`)}`);
  }
}

function publishPackages() {
  runInherit("pnpm --filter @seekdb/js-bindings publish --no-git-checks");
  runInherit("pnpm run build:seekdb");
  runInherit("pnpm --filter seekdb publish --no-git-checks");
}

function main() {
  const args = parseArgs(process.argv);
  const plans = planRelease(args);

  if (!args.dryRun) {
    assertCanRelease(plans, args);
  }

  printPlan(plans, args);

  if (args.dryRun) {
    console.log("(dry-run) no files, tags, npm, or GitHub changes made");
    return;
  }

  applyVersionBump(plans);
  commitAndTag(plans);
  console.log("\nCreated release commit and package tags.\n");

  if (!args.versionOnly) {
    publishPackages();
    console.log("\nPublished to npm.\n");
    runInherit("node scripts/create-github-release.js");
  }

  if (!args.noPush) {
    runInherit("git push");
    runInherit("git push --tags");
  }

  console.log("\nDone.");
}

main();
