# Test Layout

## Directory structure

Tests are grouped by feature. Server and Embedded modes share the same layout under their roots.

```
tests/
├── unit/                    # Unit tests (no database)
├── client/                  # Client creation, factory, connection
├── collection/              # Collection operations
├── embedding/               # Embedding function
├── admin/                   # Admin / database management
├── data/                    # Data normalization, etc.
├── edge-cases/              # Edge cases and errors
├── examples/                # Examples
├── test-utils.ts            # Shared test helpers (server mode)
└── embedded/                # Embedded-mode tests (same layout; requires native addon)
    ├── client/
    ├── mode-consistency.test.ts  # Embedded vs server behavior consistency
    ├── collection/
    ├── embedding/
    ├── data/
    ├── edge-cases/
    ├── examples/
    └── test-utils.ts        # Embedded-specific helpers (getTestDbDir, cleanupTestDb, etc.)
```

## Import paths

### Server-mode tests (`tests/{category}/`)

- From src: `from "../../src/..."`
- From test-utils: `from "../test-utils.js"`

### Embedded-mode tests (`tests/embedded/{category}/`)

- From src: `from "../../../src/..."` (or `../../../src` when in subdirs like `embedded/collection/`)
- From root test-utils (e.g. `generateCollectionName`, `MockEmbeddingFunction`): `from "../../test-utils.js"`
- From embedded test-utils (`getTestDbDir`, `cleanupTestDb`, `getEmbeddedTestConfig`): `from "../test-utils.js"` (when in `embedded/client/`, `embedded/collection/`, etc., `../test-utils.js` points to `embedded/test-utils.ts`)

### Unit tests (`tests/unit/`)

- From src: `from "../../src/..."`
- From errors: `from "../../src/errors.js"`

## Running tests

```bash
# All tests (from repo root)
pnpm test

# From packages/seekdb
pnpm exec vitest run

# Specific area
pnpm exec vitest run tests/collection/

# Embedded only (requires native addon)
pnpm exec vitest run tests/embedded/

# Unit tests only (fastest)
pnpm exec vitest run tests/unit/
```

## Embedded mode

- **Location**: `tests/embedded/` mirrors the server layout so the same scenarios can run without a server.
- **Config**: Use `getEmbeddedTestConfig(testFileName)` for `{ path, database }`; admin tests use `AdminClient({ path })`.
- **Cleanup**: Call `cleanupTestDb(testFileName)` in `beforeAll`; each file uses its own DB dir via `getTestDbDir(testFileName)` to avoid cross-test effects.
- **Coverage**: See `tests/embedded/COVERAGE_REPORT.md` for how server and embedded tests align and any differences.
