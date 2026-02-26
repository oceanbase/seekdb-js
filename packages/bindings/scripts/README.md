# SeekDB Bindings Scripts

This directory contains Python scripts for managing the seekdb native bindings, following the pattern from duckdb-node-neo.

## Scripts

### `fetch_libseekdb.py`

Generic utility module for downloading libseekdb library files from a URL (zip archive).

**Function signature:**

```python
fetch_libseekdb(zip_url, output_dir)
```

Downloads the zip and extracts all contents into `output_dir`.

### `libseekdb_url_config.py`

**URL is maintained here.** All platform scripts get the zip download prefix from this file:

- Current: S3 build artifacts (`oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com`)
- Original GitHub releases URL is kept in the file but commented out; uncomment to switch back

To change the download source or commit path, edit `LIBSEEKDB_URL_PREFIX` in `libseekdb_url_config.py`.

### Platform-specific fetch scripts

These scripts download libseekdb files for specific platforms. They are automatically called by `node-gyp` during the build process via `binding.gyp`:

- `fetch_libseekdb_linux_x64.py` - Linux x64
- `fetch_libseekdb_linux_arm64.py` - Linux arm64
- `fetch_libseekdb_darwin_arm64.py` - macOS arm64 (Apple Silicon)

Note: Windows and macOS x64 (Intel Silicon) is not currently supported.

**Manual usage (if needed):**

```bash
python scripts/fetch_libseekdb_linux_x64.py
```

Each script specifies:

- `zip_url`: Built from the shared prefix via `libseekdb_url_config.get_zip_url()`
- `output_dir`: Directory to extract all zip contents to (defaults to `../libseekdb`)

### `checkFunctionSignatures.mjs`

Checks that function signatures in TypeScript definitions and C++ bindings match the C API header.

**Usage:**

```bash
# Check signatures
node scripts/checkFunctionSignatures.mjs

# Write signature files for comparison
node scripts/checkFunctionSignatures.mjs writeFiles

# Remove signature files
node scripts/checkFunctionSignatures.mjs removeFiles
```

## NPM Scripts

The following npm scripts are available in `package.json`:

```bash
# Build (automatically fetches libseekdb via node-gyp)
pnpm run build

# Check function signatures
pnpm run check:signatures
```

Note: The libseekdb library is automatically fetched during the build process through `binding.gyp` dependencies. No manual fetch scripts are needed.

## Dependencies

Python 3.x is required. The scripts use standard library modules:

- `os` - File system operations
- `urllib.request` - HTTP downloads
- `zipfile` - Zip archive extraction
