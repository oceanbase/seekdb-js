# Development Guide

- [Development Guide](#development-guide)
  - [Prerequisites](#prerequisites)
  - [Running Modes](#running-modes)
  - [Run Examples](#run-examples)
    - [Setup](#setup)
    - [Run Examples](#run-examples-1)
  - [Developers](#developers)
    - [Setup](#setup-1)
    - [Run Tests](#run-tests)
    - [Linting \& Formatting](#linting--formatting)

## Prerequisites

- **Node.js**: Version >= 20
- **Package Manager**: pnpm
- **Database / running mode**:
  - **Embedded mode**: No seekdb server required; install and build, then run examples and tests (using local `seekdb.db` or a custom `path`). Depends on the native addon (see `packages/bindings`). All embedded tests live under `packages/seekdb/tests/embedded/` and mirror server-mode scenarios.
  - **Server mode**: A running seekdb or OceanBase instance (local or remote) is required.
    - Default connection: Host `127.0.0.1`, Port `2881`, User `root`, Database `test`
    - OceanBase mode requires Tenant: `sys`

## Running Modes

- **Embedded mode**: `new SeekdbClient({ path: "..." })`. Data is stored under the given path; no server needed. Admin operations use `AdminClient({ path: "..." })`, which returns a `SeekdbClient`. Examples and embedded-only tests run without a database server.
- **Server mode**: `new SeekdbClient({ host, port, ... })` connects to a deployed seekdb/OceanBase. Start the database and verify connection settings before running server-mode examples.

## Run Examples

### Setup

Run the following commands in the project root to install dependencies and build the project:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Run Examples

**Basic examples** (root `examples/`): run from the `examples` directory:

```bash
cd examples
pnpm install
pnpm run run:simple    # Basic usage
pnpm run run:complete  # Full feature demo
pnpm run run:hybrid    # Hybrid search
```

**ORM integration examples** (each has its own `package.json` under `examples/`):

- **seekdb-drizzle** (Drizzle ORM):

  ```bash
  pnpm --filter seekdb-drizzle-example run start           # Server mode
  pnpm --filter seekdb-drizzle-example run start:embedded  # Embedded mode
  ```

- **seekdb-prisma** (Prisma ORM):
  ```bash
  pnpm --filter seekdb-prisma-example run db:generate
  pnpm --filter seekdb-prisma-example run start           # Server (requires db:push and DATABASE_URL)
  pnpm --filter seekdb-prisma-example run start:embedded # Embedded (no server)
  ```

**Running mode**:

- Examples use **embedded mode** by default where applicable (`path: "./seekdb.db"`); no seekdb server is required.
- For **server mode**, start seekdb/OceanBase and set connection config (e.g. `host`, `port`, `DATABASE_URL`); see each example’s README.

---

## Developers

To participate in SDK development or debugging, follow these steps.

### Setup

Run the following commands in the project root to install dependencies and build the project:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Run Tests

The project uses Vitest. From the project root:

```bash
# Run all tests (seekdb + @seekdb/prisma-adapter; runs once and exits)
pnpm test

# Run only seekdb package tests
pnpm --filter seekdb run test

# Watch mode for seekdb (during development)
pnpm --filter seekdb exec vitest

# Run only @seekdb/prisma-adapter tests
pnpm --filter @seekdb/prisma-adapter run test

# Run only embedded-mode tests (no server required)
pnpm --filter seekdb exec vitest run tests/embedded/
```

**Tests and running mode**:

- **Embedded-mode tests** live under `packages/seekdb/tests/embedded/` and use a temporary database path per test file. They do not require a seekdb/OceanBase server.
- **Server-mode tests** (under `packages/seekdb/tests/` but outside `embedded/`) connect to `127.0.0.1:2881` and require a local seekdb or OceanBase instance. Override with `SEEKDB_HOST`, `SEEKDB_PORT`, `SEEKDB_USER`, `SEEKDB_PASSWORD`, `SEEKDB_DATABASE`.
- **Mode consistency** tests (`tests/embedded/mode-consistency.test.ts`) run both embedded and server modes; they require the native addon and a server for the server part.
- Embedded test coverage vs server is documented in `packages/seekdb/tests/embedded/COVERAGE_REPORT.md`.

### Linting & Formatting

```bash
# Run lint check
pnpm lint

# Format code
pnpm prettier
```
