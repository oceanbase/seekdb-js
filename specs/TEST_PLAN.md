# SeekDB Node SDK 测试计划

## 测试目标

1. 确保与 Python SDK 功能完全对齐
2. 验证所有 API 的正确性
3. 保持测试代码简洁易维护

## 功能对比清单

### Client 级别 API

| 功能           | Python SDK                      | Node SDK                     | 测试状态 |
| -------------- | ------------------------------- | ---------------------------- | -------- |
| 创建集合       | ✅ `create_collection()`        | ✅ `createCollection()`      | ⬜       |
| 获取集合       | ✅ `get_collection()`           | ✅ `getCollection()`         | ⬜       |
| 获取或创建集合 | ✅ `get_or_create_collection()` | ✅ `getOrCreateCollection()` | ⬜       |
| 删除集合       | ✅ `delete_collection()`        | ✅ `deleteCollection()`      | ⬜       |
| 列出集合       | ✅ `list_collections()`         | ✅ `listCollections()`       | ⬜       |
| 检查集合存在   | ✅ `has_collection()`           | ✅ `hasCollection()`         | ⬜       |
| 集合计数       | ✅ `count_collections()`        | ✅ `countCollection()`       | ⬜       |
| 执行 SQL       | ✅ `execute()`                  | ✅ `execute()`               | ⬜       |
| 关闭连接       | ✅ `close()`                    | ✅ `close()`                 | ⬜       |

### Collection 级别 API

| 功能        | Python SDK           | Node SDK            | 测试状态 |
| ----------- | -------------------- | ------------------- | -------- |
| 添加数据    | ✅ `add()`           | ✅ `add()`          | ⬜       |
| 更新数据    | ✅ `update()`        | ✅ `update()`       | ⬜       |
| Upsert 数据 | ✅ `upsert()`        | ✅ `upsert()`       | ⬜       |
| 删除数据    | ✅ `delete()`        | ✅ `delete()`       | ⬜       |
| 获取数据    | ✅ `get()`           | ✅ `get()`          | ⬜       |
| 查询数据    | ✅ `query()`         | ✅ `query()`        | ⬜       |
| 混合搜索    | ✅ `hybrid_search()` | ✅ `hybridSearch()` | ⬜       |
| 数据计数    | ✅ `count()`         | ✅ `count()`        | ⬜       |
| Peek 数据   | ✅ `peek()`          | ✅ `peek()`         | ⬜       |

### 过滤器功能

| 功能                           | Python SDK | Node SDK | 测试状态 |
| ------------------------------ | ---------- | -------- | -------- |
| 元数据过滤 - $eq               | ✅         | ✅       | ⬜       |
| 元数据过滤 - $ne               | ✅         | ✅       | ⬜       |
| 元数据过滤 - $gt/$gte/$lt/$lte | ✅         | ✅       | ⬜       |
| 元数据过滤 - $in/$nin          | ✅         | ✅       | ⬜       |
| 元数据过滤 - $and/$or          | ✅         | ✅       | ⬜       |
| 文档过滤 - $contains           | ✅         | ✅       | ⬜       |
| 文档过滤 - $regex              | ✅         | ✅       | ⬜       |

## 测试组织结构

```
tests/
├── unit/                    # 单元测试
│   ├── client.test.ts      # Client 基础功能
│   ├── collection.test.ts  # Collection 基础功能
│   ├── filters.test.ts     # 过滤器测试
│   └── utils.test.ts       # 工具函数测试
│
├── integration/            # 集成测试
│   ├── crud.test.ts       # CRUD 完整流程
│   ├── query.test.ts      # 查询功能
│   ├── hybrid.test.ts     # 混合搜索
│   └── embedding.test.ts  # Embedding 函数
│
└── examples/              # 使用示例（也作为测试）
    ├── basic-usage.ts     # 基础使用
    ├── filtering.ts       # 过滤器使用
    └── hybrid-search.ts   # 混合搜索
```

## 测试实现建议

### 方案 1: 使用 Vitest（推荐）

**优点**:

- 已配置好（项目中已有 vitest）
- 快速、现代化
- 原生 TypeScript 支持
- 并行测试

**实现步骤**:

1. 在 `tests/` 目录创建测试文件
2. 每个测试文件对应一个功能模块
3. 使用 `beforeEach`/`afterEach` 清理测试数据

### 方案 2: 使用示例代码作为测试

**优点**:

- 简洁直观
- 既是文档又是测试
- 易于维护

**实现步骤**:

1. 在 `examples/` 目录创建功能示例
2. 每个示例验证一组相关功能
3. 使用 `npm run examples` 运行所有示例

## 推荐的测试优先级

### P0 - 核心功能（必须）

1. **Collection 管理**
   - 创建、获取、删除集合
   - 列出集合、检查集合存在

2. **基础 CRUD**
   - add()
   - get()
   - update()
   - delete()
   - count()

3. **向量查询**
   - query() with embeddings
   - query() with texts (需要 embedding function)

### P1 - 高级功能（重要）

1. **过滤器**
   - 元数据过滤（所有操作符）
   - 文档过滤（$contains, $regex）
   - 组合过滤

2. **混合搜索**
   - hybrid_search() 全文 + 向量

3. **Upsert 操作**

### P2 - 边界情况（建议）

1. **错误处理**
   - 无效输入
   - 不存在的集合
   - 连接错误

2. **边界值**
   - 空数据
   - 大批量数据
   - 特殊字符

## 最简测试方案（快速验证）

创建一个测试脚本覆盖所有核心功能：

```typescript
// tests/comprehensive.test.ts
import { SeekDBClient } from "../src";

async function runTests() {
  const client = new SeekDBClient({ host: "127.0.0.1", port: 2881 });

  // 1. Collection 管理
  await testCollectionManagement(client);

  // 2. CRUD 操作
  await testCRUD(client);

  // 3. 查询功能
  await testQuery(client);

  // 4. 过滤器
  await testFilters(client);

  // 5. 混合搜索
  await testHybridSearch(client);

  await client.close();
}
```

## 建议的实施路径

### 阶段 1: 核心功能验证（1-2天）

- 创建 `tests/core.test.ts`
- 测试 P0 所有功能
- 确保基础功能正常

### 阶段 2: 完整功能覆盖（2-3天）

- 创建详细的单元测试
- 覆盖 P1 功能
- 添加集成测试

### 阶段 3: 文档和示例（1-2天）

- 编写使用示例
- 创建 README
- 性能测试

## 测试数据管理

### 每次测试前清理

```typescript
beforeEach(async () => {
  const collections = await client.listCollections();
  for (const name of collections) {
    if (name.startsWith("test_")) {
      await client.deleteCollection(name);
    }
  }
});
```

### 使用唯一名称

```typescript
const collectionName = `test_${Date.now()}_${Math.random()}`;
```

## 下一步行动

您希望我：

1. **创建完整的单元测试套件** - 使用 Vitest，完整覆盖
2. **创建简洁的功能验证脚本** - 一个文件快速验证所有功能
3. **创建示例驱动的测试** - 既是文档又是测试

请告诉我您的偏好，我会立即开始实现！
