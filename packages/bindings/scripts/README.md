# SeekDB Bindings Scripts

This directory contains Python scripts for managing the seekdb native bindings, following the pattern from duckdb-node-neo.

## Scripts

### `fetch_libseekdb.py`

Generic utility module for downloading libseekdb library files from a URL (zip archive).

**Function signature:**
```python
fetch_libseekdb(zip_url, output_dir, files)
```

### Platform-specific fetch scripts

These scripts download libseekdb files from GitHub releases for specific platforms. They are automatically called by `node-gyp` during the build process via `binding.gyp`:

- `fetch_libseekdb_linux_x64.py` - Linux x64
- `fetch_libseekdb_linux_arm64.py` - Linux arm64
- `fetch_libseekdb_darwin_x64.py` - macOS x64
- `fetch_libseekdb_darwin_arm64.py` - macOS arm64

Note: Windows is not currently supported.

**Manual usage (if needed):**
```bash
python scripts/fetch_libseekdb_linux_x64.py
```

These scripts download libseekdb library files from GitHub releases. Each script specifies:
- `zip_url`: URL to the platform-specific zip archive
- `output_dir`: Directory to extract files to (defaults to `../libseekdb`)
- `files`: List of files to extract from the zip archive

To update the version or URL, modify the `zip_url` variable in each script.

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
