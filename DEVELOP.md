# Development Guide

- [Development Guide](#development-guide)
  - [Prerequisites](#prerequisites)
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
- **Database**: A running seekdb or OceanBase instance is required.
  - Default connection config:
    - Host: `127.0.0.1`
    - Port: `2881`
    - User: `root`
    - Database: `test`
    - Tenant: `sys` (Required for OceanBase mode)

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

This project provides several example in the `packages/examples` directory. You can run them directly from the root directory using the following commands:

- **Simple Example**:
  Demonstrates basic connection, collection creation, data addition, and querying.

  ```bash
  pnpm --filter seekdb-examples run run:simple
  ```

- **Complete Example**:
  Demonstrates all SDK features, including DML (CRUD), DQL (Query), Hybrid Search, etc.

  ```bash
  pnpm --filter seekdb-examples run run:complete
  ```

- **Hybrid Search Example**:
  Focuses on demonstrating hybrid search functionality.
  ```bash
  pnpm --filter seekdb-examples run run:hybrid
  ```

> **Note**: The example code connects to a local database (`127.0.0.1:2881`) by default. If your database configuration is different, please modify the `SeekdbClient` configuration in the corresponding `.ts` file under `packages/examples/`.

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

The project uses Vitest for testing. Run tests for the core package `seekdb`:

```bash
# Run all tests
pnpm test

# Or run with specific filter
pnpm --filter seekdb run test
```

### Linting & Formatting

```bash
# Run lint check
pnpm lint

# Format code
pnpm prettier
```
