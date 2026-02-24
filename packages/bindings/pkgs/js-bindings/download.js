/**
 * On-demand download of native bindings (Node fetch + adm-zip, no CLI).
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const AdmZip = require("adm-zip");

const SUPPORTED_PLATFORMS = ["darwin-arm64", "linux-x64", "linux-arm64"];
const DEFAULT_BASE_URL =
  "https://oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com/js-bindings/all_commits/10770677d3f2b57dec0e73b208e5fa61b4148091";

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

async function ensureBindingsDownloaded() {
  const cacheDir = getCacheDir();
  const nodePath = path.join(cacheDir, "seekdb.node");
  if (fs.existsSync(nodePath)) return cacheDir;

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
  return cacheDir;
}

module.exports = { ensureBindingsDownloaded, getPlatformArch };
