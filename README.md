# SeekDB Node.js SDK

SeekDB 的 Node.js 客户端 SDK，支持 seekdb 模式和 OceanBase 模式。

## 运行 example

### 1. 准备工作 (Prerequisites)

- **Node.js**: 版本需 >= 20
- **包管理器**: pnpm
- **数据库**: 需要一个运行中的 SeekDB 或 OceanBase 实例。
  - 默认连接配置:
    - Host: `127.0.0.1`
    - Port: `2881`
    - User: `root`
    - Database: `test`
    - Tenant: `sys`

### 2. 安装依赖与构建 (Installation & Build)

在项目根目录下运行以下命令来安装依赖并构建项目：

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build
```

### 3. 运行示例 (Run Examples)

本项目在 `packages/examples` 目录下提供了多个示例代码。你可以直接在根目录通过以下命令运行它们：

- **简单示例 (Simple Example)**:
  演示基本的连接、创建集合、添加数据和查询。
  ```bash
  pnpm --filter seekdb-examples run run:simple
  ```

- **完整示例 (Complete Example)**:
  演示 SDK 的所有功能，包括 DML (增删改)、DQL (查询)、混合搜索等。
  ```bash
  pnpm --filter seekdb-examples run run:complete
  ```

- **混合搜索示例 (Hybrid Search Example)**:
  重点演示混合搜索功能。
  ```bash
  pnpm --filter seekdb-examples run run:hybrid
  ```

> **注意**: 示例代码默认连接本地数据库 (`127.0.0.1:2881`)。如果你的数据库配置不同，请修改 `packages/examples/` 目录下对应 `.ts` 文件中的 `SeekDBClient` 配置。

---

## 开发者

如果您想参与 SDK 的开发或进行调试，请遵循以下步骤。

### 1. 安装依赖 (Installation)

```bash
pnpm install
```

### 2. 构建项目 (Build)

```bash
# 构建所有包
pnpm build

# 或者仅构建 seekdb-js 核心包
pnpm build:seekdb
```

### 3. 运行测试 (Run Tests)

项目使用 Vitest 进行测试。运行核心包 `seekdb-js` 的测试：

```bash
# 运行所有测试
pnpm test

# 或者指定过滤器运行
pnpm --filter seekdb-js run test
```

### 4. 代码风格与检查 (Linting & Formatting)

```bash
# 运行 Lint 检查
pnpm lint

# 运行类型检查
pnpm type-check

# 格式化代码
pnpm prettier
```

