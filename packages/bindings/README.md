# seekdb Native Bindings

This directory contains the native addon bindings for seekdb embedded mode, following the architecture pattern from `duckdb-node-neo`.

## Architecture

The native addon is structured in three layers:

1. **C++ Native Addon** (`src/seekdb_js_bindings.cpp`)
   - Uses N-API (Node Addon API) to interface with Node.js
   - Wraps seekdb C API functions
   - Provides low-level bindings for database operations

2. **JavaScript Wrapper** (`pkgs/js-bindings/seekdb.js`)
   - Loads native `.node` from `SEEKDB_BINDINGS_PATH` or from S3-downloaded zip; local dev can use sibling dirs after build
   - Supports Linux (x64/arm64) and macOS (arm64 only). **Native bindings are not published to npm**; they are built by CI and hosted on S3.

3. **TypeScript API Layer** (`../seekdb/src/client-embedded.ts`)
   - High-level TypeScript API
   - Uses the native bindings through `@seekdb/js-bindings`
   - Provides the same interface as remote server mode

## Distribution (S3, not npm)

Native bindings are **not** published to npm. They are built by [`.github/workflows/build-js-bindings.yml`](../../.github/workflows/build-js-bindings.yml) and uploaded to S3:

- **Base path**: `s3://oceanbase-seekdb-builds/js-bindings/all_commits/<commit_sha>/`
- **Zips**: `seekdb-js-bindings-linux-x64.zip`, `seekdb-js-bindings-linux-arm64.zip`, `seekdb-js-bindings-darwin-arm64.zip`
- **HTTPS**: `https://oceanbase-seekdb-builds.s3.<region>.amazonaws.com/js-bindings/all_commits/<commit_sha>/seekdb-js-bindings-<platform>.zip`

**Usage**: Download the zip for your platform, extract it to a directory, and set the environment variable:

```bash
export SEEKDB_BINDINGS_PATH=/path/to/extracted/dir   # dir must contain seekdb.node, libseekdb.so/dylib; macOS may also need libs/ for runtime deps
```

The loader package **`pkgs/js-bindings`** is the only package in the repo; it resolves the native addon from `SEEKDB_BINDINGS_PATH` or, for local development, from the same directory (`pkgs/js-bindings/seekdb.node`) after a local build.

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

- **`@seekdb/js-bindings`** (only package in repo) – Loader that loads the native addon from `SEEKDB_BINDINGS_PATH` or from sibling build output dirs. Native binaries for each platform are built by CI and hosted on S3 (not npm); users download the zip and set `SEEKDB_BINDINGS_PATH`.

### TODO

- [ ] Support for transactions (begin/commit/rollback)
- [ ] Support for execute_update (INSERT/UPDATE/DELETE)
- [ ] Add comprehensive tests for native bindings
- [ ] Support for additional data types (beyond string)
