## Run Examples

### 1. Prerequisites

- **Node.js**: Version >= 20
- **Package Manager**: pnpm
- **Database**: A running SeekDB or OceanBase instance is required.
  - Default connection config:
    - Host: `127.0.0.1`
    - Port: `2881`
    - User: `root`
    - Database: `test`
    - Tenant: `sys`

### 2. Installation & Build

Run the following commands in the project root to install dependencies and build the project:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### 3. Run Examples

This project provides several example codes in the `packages/examples` directory. You can run them directly from the root directory using the following commands:

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

> **Note**: The example code connects to a local database (`127.0.0.1:2881`) by default. If your database configuration is different, please modify the `SeekDBClient` configuration in the corresponding `.ts` file under `packages/examples/`.

---

## Developers

If you want to participate in SDK development or debugging, please follow these steps.

### 1. Installation

```bash
pnpm install
```

### 2. Build

```bash
# Build all packages
pnpm build

# Or build only the seekdb-js core package
pnpm build:seekdb
```

### 3. Run Tests

The project uses Vitest for testing. Run tests for the core package `seekdb-js`:

```bash
# Run all tests
pnpm test

# Or run with specific filter
pnpm --filter seekdb-js run test
```

### 4. Linting & Formatting

```bash
# Run Lint check
pnpm lint

# Run Type check
pnpm type-check

# Format code
pnpm prettier
```
