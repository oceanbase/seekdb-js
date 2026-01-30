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
  - **Embedded mode**: No seekdb server required; install and build, then run examples and tests (using local `seekdb.db` or a custom `path`). Depends on the native addon (see `packages/bindings`).
  - **Server mode**: A running seekdb or OceanBase instance (local or remote) is required.
    - Default connection: Host `127.0.0.1`, Port `2881`, User `root`, Database `test`
    - OceanBase mode requires Tenant: `sys`

## Running Modes

- **Embedded mode**: `SeekdbClient({ path: "..." })` or `Client({ path: "..." })`. Data is stored in a local file; no server needed. Examples and tests can run in embedded mode by default.
- **Server mode**: `SeekdbClient({ host, port, ... })` or `Client({ host, port, ... })` connects to a deployed seekdb/OceanBase. Start the database and verify connection settings before running server-mode examples.

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

Examples live in the root `examples/` directory. From the project root:

- **Simple Example**: Basic connection, collection creation, add, and query.

  ```bash
  pnpm --filter seekdb-examples run run:simple
  ```

- **Complete Example**: Full feature demo (DML, DQL, Hybrid Search, etc.).

  ```bash
  pnpm --filter seekdb-examples run run:complete
  ```

- **Hybrid Search Example**: Hybrid search usage.

  ```bash
  pnpm --filter seekdb-examples run run:hybrid
  ```

**Running mode**:

- Examples use **embedded mode** by default (`path: "./seekdb.db"`); no seekdb server is required.
- For **server mode**, start seekdb/OceanBase and adjust the `SeekdbClient` config in the example (e.g. `host`, `port`, `user`, `password`); see comments in each example file.

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

The project uses Vitest. Run tests for the core `seekdb` package from the project root:

```bash
# Run all tests
pnpm test

# Run only seekdb package tests
pnpm --filter seekdb run test
```

**Tests and running mode**:

- Many tests use **embedded mode** (in-memory or temporary `path`) and pass without an external database.
- Some tests target **server mode** (connecting to `127.0.0.1:2881`) and require a local seekdb/OceanBase instance. If none is running, you can run only embedded-mode tests (see the `embedded/` directory under `packages/seekdb/tests/`).

### Linting & Formatting

```bash
# Run lint check
pnpm lint

# Format code
pnpm prettier
```
