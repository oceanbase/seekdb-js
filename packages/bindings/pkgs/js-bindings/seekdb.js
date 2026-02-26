const path = require("path");
const { ensureBindingsDownloaded } = require("./download.js");

/** Sync load from same dir (npm package / local build). Returns null if not found. */
function getNativeNodeBindingSync() {
  try {
    return require(path.join(__dirname, "seekdb.node"));
  } catch {
    return null;
  }
}

let _cachedBinding = null;
let _loadPromise = null;

/** Async load: try sync, else on-demand download then load from cache. Dedupes concurrent calls. */
async function getNativeBindingAsync() {
  if (_cachedBinding) return _cachedBinding;
  try {
    const sync = getNativeNodeBindingSync();
    if (sync) {
      _cachedBinding = sync;
      return sync;
    }
  } catch (_) {
    // Sync load failed; fall back to download
  }
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const cacheDir = await ensureBindingsDownloaded();
      _cachedBinding = require(path.join(cacheDir, "seekdb.node"));
      return _cachedBinding;
    } catch (err) {
      _loadPromise = null;
      throw err;
    }
  })();
  return _loadPromise;
}

const syncBinding = getNativeNodeBindingSync();

if (syncBinding) {
  // Bindings available: export them directly; async helper returns same instance
  _cachedBinding = syncBinding;
  module.exports = syncBinding;
  module.exports.getNativeBindingAsync = () => Promise.resolve(syncBinding);
} else {
  // Bindings not available: export only async API (on-demand download when called)
  module.exports = {
    getNativeBindingAsync,
  };
}
