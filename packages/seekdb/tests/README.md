# 测试文件组织说明

## 目录结构

测试文件按功能分类组织，Server 和 Embedded 模式保持相同的目录结构。

```
tests/
├── unit/                    # 单元测试（不需要数据库）
├── client/                  # 客户端相关
├── collection/              # Collection 操作
├── embedding/               # Embedding Function
├── admin/                   # 管理功能
├── data/                    # 数据相关
├── edge-cases/              # 边界情况
├── examples/                # 示例
├── mode-consistency.test.ts # 模式一致性对比
├── test-utils.ts            # 测试工具（Server 模式）
└── embedded/                # Embedded Mode 测试（相同结构）
    ├── client/
    ├── collection/
    ├── embedding/
    ├── data/
    ├── edge-cases/
    ├── examples/
    └── test-utils.ts        # 测试工具（Embedded 模式）
```

## 导入路径规则

### Server Mode 测试（`tests/{category}/`）

- 导入 src：`from "../../src/..."`
- 导入 test-utils：`from "../test-utils.js"`

### Embedded Mode 测试（`tests/embedded/{category}/`）

- 导入 src：`from "../../../src/..."`（若在 `embedded/collection/` 等子目录则为 `../../../src`）
- 导入根目录 test-utils（如 `generateCollectionName`、`MockEmbeddingFunction`）：`from "../../test-utils.js"`
- 导入 embedded 专用 test-utils（`getEmbeddedTestConfig`、`cleanupTestDb`、`getTestDbDir`）：`from "../test-utils.js"`（若在 `embedded/client/` 或 `embedded/collection/` 等，则用 `../test-utils.js` 指向 `embedded/test-utils.ts`）

### 单元测试（`tests/unit/`）

- 导入 src：`from "../../src/..."`
- 导入 errors：`from "../../src/errors.js"`

## 测试执行

```bash
# 所有测试
npx vitest packages/seekdb/tests

# 特定功能
npx vitest packages/seekdb/tests/collection/

# Embedded 模式
npx vitest packages/seekdb/tests/embedded/

# 单元测试（最快）
npx vitest packages/seekdb/tests/unit/
```

## Embedded 模式说明

- **目录**：`tests/embedded/` 下结构与 server 对应，用例与 server 模式对齐，便于无服务器环境下跑全量单测。
- **配置**：使用 `getEmbeddedTestConfig(testFileName)` 得到 `{ path, database }`；管理端使用 `AdminClient({ path: TEST_CONFIG.path })`。
- **清理**：`beforeAll` 中调用 `cleanupTestDb(testFileName)`；每个测试文件使用独立目录 `getTestDbDir(testFileName)`。
- **覆盖报告**：见 `tests/embedded/COVERAGE_REPORT.md`。
  ��该测试文件对应的数据库目录；每个测试文件使用独立目录（`getTestDbDir(testFileName)`），避免互相影响。
- **覆盖报告**：Server 与 Embedded 用例对应关系及差异说明见 `tests/embedded/COVERAGE_REPORT.md`。
