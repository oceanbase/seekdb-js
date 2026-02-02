const path = require('path');

const getRuntimePlatformArch = () => `${process.platform}-${process.arch}`;

const S3_BINDINGS_BASE =
  'https://oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com/seekdb-js-bindings/all_commits/';

/**
 * Load native binding: from SEEKDB_BINDINGS_PATH, or from sibling dir (local dev build), or throw.
 * @throw Error if there isn't any available native binding for the current platform/arch.
 */
function getNativeNodeBinding(runtimePlatformArch) {
  const [platform, arch] = runtimePlatformArch.split('-');
  const dirName = `js-bindings-${platform}-${arch}`;

  // 1) Explicit path (e.g. user downloaded zip from S3 and set env)
  const envPath = process.env.SEEKDB_BINDINGS_PATH;
  if (envPath) {
    const nodePath = path.join(envPath, 'seekdb.node');
    try {
      return require(nodePath);
    } catch (err) {
      throw new Error(
        `SeekDB native binding: SEEKDB_BINDINGS_PATH is set but failed to load ${nodePath}: ${err.message}. ` +
          `Ensure the directory contains seekdb.node (and libseekdb.so/dylib). Download from S3 if needed.`
      );
    }
  }

  // 2) Sibling dir (local dev: bindings built in monorepo, pkgs/js-bindings-<platform>-<arch>)
  const siblingPath = path.join(__dirname, '..', dirName, 'seekdb.node');
  try {
    return require(siblingPath);
  } catch {
    // Fall through to error
  }

  throw new Error(
    `SeekDB native binding not found for ${runtimePlatformArch}. ` +
      `Set SEEKDB_BINDINGS_PATH to a directory containing seekdb.node (and libseekdb.so/dylib), ` +
      `or download the prebuilt binding from S3: ${S3_BINDINGS_BASE}<commit_sha>/seekdb-js-bindings-${runtimePlatformArch}.zip`
  );
}

module.exports = getNativeNodeBinding(getRuntimePlatformArch());
