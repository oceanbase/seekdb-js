/**
 * On-demand download of native bindings (Node fetch + adm-zip, no CLI).
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const AdmZip = require("adm-zip");

const SUPPORTED_PLATFORMS = [
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
];
const DEFAULT_BASE_URL =
  "https://oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com/js-bindings/all_commits/469a55dc84ea7a9e077161a8b454871a9adaff35";

function getPlatformArch() {
  const key = `${process.platform}-${process.arch === "arm64" ? "arm64" : "x64"}`;
  if (!SUPPORTED_PLATFORMS.includes(key)) {
    throw new Error(
      `Unsupported platform: ${key}. Supported: ${SUPPORTED_PLATFORMS.join(", ")}.`
    );
  }
  return key;
}

function getBindingsBaseUrl() {
  const env = process.env.SEEKDB_BINDINGS_BASE_URL;
  return (env && env.trim() ? env : DEFAULT_BASE_URL).replace(/\/$/, "");
}

function getCacheDir() {
  const base =
    process.env.SEEKDB_BINDINGS_CACHE_DIR ||
    path.join(os.homedir(), ".seekdb", "bindings");
  const baseUrl = getBindingsBaseUrl();
  let version = "unknown";
  try {
    const segments = new URL(baseUrl).pathname.split("/").filter(Boolean);
    version = segments.length ? segments[segments.length - 1] : version;
  } catch (e) {
    throw new Error(
      `SEEKDB_BINDINGS_BASE_URL must be a valid URL (e.g. https://...). Got: ${baseUrl}`
    );
  }
  return path.join(base, version, getPlatformArch());
}

/** Copy libs/*.dll next to seekdb.node; Node on Windows does not search libs/ for native deps. */
function prepareWin32BindingsDir(bindingsDir) {
  if (process.platform !== "win32") return;
  const libsDir = path.join(bindingsDir, "libs");
  if (!fs.existsSync(libsDir)) return;
  for (const name of fs.readdirSync(libsDir)) {
    if (!name.toLowerCase().endsWith(".dll")) continue;
    const dest = path.join(bindingsDir, name);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(libsDir, name), dest);
    }
  }
}

function isBindingsDirReady(bindingsDir) {
  if (!fs.existsSync(path.join(bindingsDir, "seekdb.node"))) {
    return false;
  }
  if (process.platform === "win32") {
    return fs.existsSync(path.join(bindingsDir, "seekdb.dll"));
  }
  return true;
}

async function ensureBindingsDownloaded() {
  const cacheDir = getCacheDir();
  const nodePath = path.join(cacheDir, "seekdb.node");
  if (isBindingsDirReady(cacheDir)) {
    prepareWin32BindingsDir(cacheDir);
    return cacheDir;
  }

  const platform = getPlatformArch();
  const zipPath = path.join(cacheDir, `seekdb-js-bindings-${platform}.zip`);

  if (!fs.existsSync(zipPath)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const url = `${getBindingsBaseUrl()}/seekdb-js-bindings-${platform}.zip`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${url}`);
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(cacheDir, true);

  if (!fs.existsSync(nodePath)) {
    throw new Error(`Zip did not contain seekdb.node: ${zipPath}`);
  }
  if (!isBindingsDirReady(cacheDir)) {
    throw new Error(
      `Zip missing Windows runtime (seekdb.node and seekdb.dll required): ${zipPath}`
    );
  }
  prepareWin32BindingsDir(cacheDir);
  return cacheDir;
}

module.exports = {
  ensureBindingsDownloaded,
  getPlatformArch,
  prepareWin32BindingsDir,
};
