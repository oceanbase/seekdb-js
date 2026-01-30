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
- 导入 src：`from "../../../src/..."`
- 导入 test-utils（根目录）：`from "../../test-utils.js"`
- 导入 embedded/test-utils：`from "../../test-utils.js"`（embedded 目录下的）

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
