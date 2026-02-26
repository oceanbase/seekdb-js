# seekdb Native Bindings

This directory contains the native addon bindings for seekdb embedded mode, following the architecture pattern from `duckdb-node-neo`.

## Architecture

The native addon is structured in three layers:

1. **C++ Native Addon** (`src/seekdb_js_bindings.cpp`)
   - Uses N-API (Node Addon API) to interface with Node.js
   - Wraps seekdb C API functions
   - Provides low-level bindings for database operations

2. **JavaScript Wrapper** (`pkgs/js-bindings/seekdb.js`)
   - Loads native `.node` from same dir (npm package / local build) or on-demand download (Node fetch + adm-zip)
   - Supports Linux (x64/arm64) and macOS (arm64 only). **Native bindings are not on npm**; built by CI and hosted on S3.

3. **TypeScript API Layer** (`../seekdb/src/client-embedded.ts`)
   - High-level TypeScript API
   - Uses the native bindings through `@seekdb/js-bindings`
   - Provides the same interface as remote server mode

## Distribution (S3, not npm)

Native bindings are **not** published to npm. They are built by [`.github/workflows/build-js-bindings.yml`](../../.github/workflows/build-js-bindings.yml) and uploaded to S3. Each set of artifacts lives in a directory that contains `seekdb-js-bindings-<platform>.zip` for each platform (e.g. linux-x64, linux-arm64, darwin-arm64).

**Usage**: When embedded mode is first used, the loader uses same-dir `seekdb.node` (npm package or local build) or downloads bindings on demand. Optional env:

- `SEEKDB_BINDINGS_BASE_URL` – URL of the directory that contains the zip files (parent of `seekdb-js-bindings-<platform>.zip`). Defaults to a built-in URL.
- `SEEKDB_BINDINGS_CACHE_DIR` – cache directory for the downloaded zip to avoid repeated downloads (default: `~/.seekdb/bindings`). The zip is stored here and extracted for loading; subsequent runs reuse the cached zip.

The loader **`pkgs/js-bindings`** resolves the native addon from the same directory (`seekdb.node`) or via on-demand download.

## Building (CI / local dev)

To build the native addon locally (e.g. for development):

```bash
cd bindings
pnpm install
pnpm run build
```

This will:

1. Fetch the libseekdb library for your platform (Python scripts invoked by `binding.gyp`)
2. If the archive contains a `libs/` directory, copy it to `pkgs/js-bindings/libs/` (e.g. macOS runtime deps)
3. Compile the C++ bindings with node-gyp and copy `seekdb.node` and `libseekdb.so`/`libseekdb.dylib` into `pkgs/js-bindings/`

## Platform Support

The bindings support the following platforms:

- Linux x64
- Linux arm64
- macOS arm64 (Apple Silicon)

Note: macOS x64 and Windows are not currently supported.

## C API Integration

The bindings use the seekdb C API (see `seekdb.h` in `libseekdb/` after fetch) and link against `libseekdb.so` / `libseekdb.dylib`. The native library is downloaded and extracted by platform-specific Python scripts in `scripts/` (invoked from `binding.gyp`); see `scripts/README.md` for details.

### Current Implementation

- ✅ Database open/close operations
- ✅ Connection management
- ✅ Async SQL execution with Promise-based API
- ✅ Result set handling with row/column access
- ✅ Error handling

### Naming Convention

All C++ wrapper types use `Seekdb` (db in lowercase) to match the seekdb package naming convention:

- `SeekdbDatabase` - Database wrapper
- `SeekdbConnection` - Connection wrapper
- `SeekdbResultWrapper` - Result wrapper (named `Wrapper` to avoid conflict with C API `SeekdbResult` type)
- `SeekdbNodeAddon` - Main addon class

Note: C API types (`SeekdbHandle`, `SeekdbResult`, `SeekdbRow`) from seekdb.h use lowercase "db" to match the seekdb package naming convention.

### Package Structure

- **`@seekdb/js-bindings`** – Loader: same-dir `seekdb.node` or on-demand download (cached under `SEEKDB_BINDINGS_CACHE_DIR`). Binaries are built by CI and hosted on S3 (not npm).

### TODO

- [ ] Support for transactions (begin/commit/rollback)
- [ ] Support for execute_update (INSERT/UPDATE/DELETE)
- [ ] Add comprehensive tests for native bindings
- [ ] Support for additional data types (beyond string)
