const path = require("path");

const getRuntimePlatformArch = () => `${process.platform}-${process.arch}`;

/**
 * Load native binding: from SEEKDB_BINDINGS_PATH, or from sibling dir (local dev build), or throw.
 * @throw Error if there isn't any available native binding for the current platform/arch.
 */
function getNativeNodeBinding(runtimePlatformArch) {
  // 1) Explicit path (e.g. user downloaded zip from S3 and set env)
  const envPath = process.env.SEEKDB_BINDINGS_PATH;
  if (envPath) {
    const nodePath = path.join(envPath, "seekdb.node");
    try {
      return require(nodePath);
    } catch (err) {
      throw new Error(
        `SeekDB native binding: SEEKDB_BINDINGS_PATH is set but failed to load ${nodePath}: ${err.message}. ` +
          `Ensure the directory contains seekdb.node (and libseekdb.so/dylib).`
      );
    }
  }

  // 2) Same dir (local dev: build outputs seekdb.node into pkgs/js-bindings)
  const sameDirPath = path.join(__dirname, "seekdb.node");
  try {
    return require(sameDirPath);
  } catch {
    // Fall through to error
  }

  throw new Error(
    `SeekDB native binding not found for ${runtimePlatformArch}. ` +
      `Set SEEKDB_BINDINGS_PATH to a directory containing seekdb.node (and libseekdb.so/dylib).`
  );
}

module.exports = getNativeNodeBinding(getRuntimePlatformArch());
