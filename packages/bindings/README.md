# seekdb Native Bindings

This directory contains the native addon bindings for seekdb embedded mode, following the architecture pattern from `duckdb-node-neo`.

## Architecture

The native addon is structured in three layers:

1. **C++ Native Addon** (`src/seekdb_js_bindings.cpp`)
   - Uses N-API (Node Addon API) to interface with Node.js
   - Wraps seekdb C API functions
   - Provides low-level bindings for database operations

2. **JavaScript Wrapper** (`pkgs/js-bindings/seekdb.js`)
   - Platform-specific loading of `.node` files
   - Supports Linux (x64/arm64) and macOS (x64/arm64)

3. **TypeScript API Layer** (`../seekdb/src/client-embedded.ts`)
   - High-level TypeScript API
   - Uses the native bindings through `@seekdb/js-bindings`
   - Provides the same interface as remote server mode

## Building

To build the native addon:

```bash
cd bindings
npm install
npm run build
```

This will:
1. Fetch the seekdb library for your platform (via Python scripts)
2. Compile the C++ bindings using node-gyp
3. Copy the compiled `.node` file and library to platform-specific packages

## Platform Support

The bindings support the following platforms:
- Linux x64
- Linux arm64
- macOS x64
- macOS arm64

Note: Windows is not currently supported.

## C API Integration

The bindings use the seekdb C API from `https://github.com/oceanbase/seekdb/src/include/seekdb.h` and link against `libseekdb.so` from the build directory.

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

The bindings are organized as follows:
- `@seekdb/js-bindings` - Main package that loads platform-specific bindings
- `@seekdb/js-bindings-linux-x64` - Linux x64 binaries
- `@seekdb/js-bindings-linux-arm64` - Linux arm64 binaries
- `@seekdb/js-bindings-darwin-x64` - macOS x64 binaries
- `@seekdb/js-bindings-darwin-arm64` - macOS arm64 binaries

### TODO

- [ ] Add fetch scripts for libseekdb (similar to duckdb-node-neo)
- [ ] Support for transactions (begin/commit/rollback)
- [ ] Support for execute_update (INSERT/UPDATE/DELETE)
- [ ] Add comprehensive tests for native bindings
- [ ] Support for additional data types (beyond string)
