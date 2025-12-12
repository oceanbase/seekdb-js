[13 tools called]

以下是对 `@src` 目录（`packages/seekdb/src`）下所有文件的缩略介绍和内容梗概。这些文件共同构成了一个名为 **SeekDB** 的 Node.js SDK，其核心是一个基于 SQL（兼容 MySQL 协议）的向量数据库客户端，支持向量检索、全文检索和混合检索。

### 核心功能模块

#### 1. `client.ts` (客户端入口)
- **简介**: SDK 的主入口点，用于建立与 SeekDB 服务器的连接并管理集合（Collection）。
- **核心内容**:
  - `SeekDBClient` 类：负责初始化内部连接。
  - **关键 API**:
    - `createCollection(options)`: 创建新集合。会自动调用 Embeddings 函数计算维度，生成带有 `VECTOR` 类型和 HNSW 索引的 SQL `CREATE TABLE` 语句。
    - `getCollection(name)`: 获取现有集合，会自动解析远程表的 schema（维度、距离度量）。
    - `listCollections()`: 列出当前租户下的所有向量集合。
    - `getOrCreateCollection()`: 方便的辅助方法。

#### 2. `collection.ts` (集合操作 - **核心重点**)
- **简介**: 向量数据库操作的核心类，处理数据的增删改查（CRUD）和检索。
- **核心内容**:
  - **向量检索 API**:
    - `query()`: 执行近似最近邻（ANN）搜索。支持 `queryTexts`（自动生成向量）或 `queryEmbeddings`。
    - `hybridSearch()`: **特色功能**。支持结合全文检索（Text Search）和向量检索（Vector Search）的混合查询，利用 RRF（Reciprocal Rank Fusion）进行重排序。
  - **数据管理 API**:
    - `add()` / `upsert()` / `update()`: 插入或更新数据。支持自动将文本转换为向量（如果配置了 EmbeddingFunction）。
    - `delete()`: 根据 ID 或元数据过滤器删除数据。
    - `get()` / `peek()`: 获取数据详情。
  - **实现细节**: 内部通过 `SQLBuilder` 将操作转换为 SQL 语句，通过 `mysql2` 驱动执行。

#### 3. `embedding-function.ts` (向量生成抽象)
- **简介**: 定义了将文本转换为向量的接口和注册机制。
- **核心内容**:
  - `IEmbeddingFunction` 接口：定义 `generate(texts): Promise<number[][]>` 方法。
  - `registerEmbeddingFunction` / `getEmbeddingFunction`: 提供插件式的 Embedding 模型加载机制。如果未指定，尝试加载默认模型或报错提示安装。

### SQL 与 查询构建模块

#### 4. `sql-builder.ts` (SQL 构建器)
- **简介**: 将面向对象的向量操作转换为具体的 SQL 语句，屏蔽了底层 SQL 方言的复杂性。
- **重点观察**:
  - **DDL 构建**: `buildCreateTable` 中可以看到具体的向量索引定义：`VECTOR INDEX ... WITH(distance=..., type=hnsw, lib=vsag)`，表明底层使用了 **VSAG** 算法库。
  - **DML 构建**: 将向量数组转换为字符串格式（如 `[0.1, 0.2]`）以适配 SQL 语法。
  - **混合检索**: `buildHybridSearchGetSql` 使用了特殊的存储过程 `DBMS_HYBRID_SEARCH.GET_SQL`，这表明 SeekDB 可能基于 OceanBase 或类似的具备高级向量扩展的数据库。

#### 5. `filters.ts` (过滤器构建)
- **简介**: 将类似于 MongoDB 的 JSON 查询语法转换为 SQL `WHERE` 子句。
- **核心内容**:
  - `FilterBuilder` 类：
    - **元数据过滤**: 支持 `$eq`, `$gt`, `$lt`, `$in`, `$and`, `$or` 等操作符，转换为 `JSON_EXTRACT(metadata, '$.key')` 形式的 SQL。
    - **文档内容过滤**: 支持 `$contains` (转换为 SQL `MATCH...AGAINST` 全文索引查询) 和 `$regex`。
    - **混合检索过滤**: 将过滤器转换为特定的 JSON 结构供混合检索引擎使用。

### 基础架构与类型定义

#### 6. `connection.ts` (连接管理)
- **简介**: 封装 `mysql2/promise` 连接池。
- **核心内容**: 处理数据库连接的建立、保活、关闭以及基础的 SQL 执行 (`execute`)。

#### 7. `types.ts` (类型定义)
- **简介**: 定义了 SDK 的所有 TypeScript 类型。
- **重点观察**:
  - `DistanceMetric`: 支持 `l2` (欧氏距离), `cosine` (余弦相似度), `inner_product` (内积)。
  - `Where` / `WhereDocument`: 定义了过滤器的递归结构。
  - `QueryResult` / `HybridSearchOptions`: 定义了检索请求和响应的数据形状。

#### 8. `internal-client.ts` (内部客户端)
- **简介**: `SeekDBClient` 和 `SeekDBAdminClient` 共用的内部包装类。
- **核心内容**: 持有 `tenant`（租户）和 `database` 信息，充当上层 API 和底层 `Connection` 之间的桥梁。

### 管理与辅助模块

#### 9. `admin-client.ts` (管理客户端)
- **简介**: 用于数据库层面的管理操作（而非集合层面）。
- **核心内容**: 提供 `createDatabase`, `deleteDatabase`, `listDatabases` 接口，支持多租户隔离。

#### 10. `utils.ts` (工具函数)
- **简介**: 通用辅助函数。
- **核心内容**:
  - `vectorToSqlString`: 将 JS 数组转为向量数据库可识别的字符串格式。
  - `serializeMetadata` / `deserializeMetadata`: 处理元数据的 JSON 序列化。
  - 表名生成规则：`c$v1${collectionName}`。

#### 11. `errors.ts` (错误处理)
- **简介**: 自定义错误类。
- **核心内容**: 包含 `SeekDBConnectionError`, `SeekDBValueError`, `InvalidCollectionError` 等，用于区分网络、参数或逻辑错误。

#### 12. `database.ts` (数据库实体)
- **简介**: 简单的数据库信息载体类。

#### 13. `index.ts` (导出文件)
- **简介**: 统一导出 SDK 的公共 API。

---

**总结**:
SeekDB Node SDK 是一个设计清晰的向量数据库客户端。它通过 `Collection` 类提供了友好的 CRUD 和向量检索接口，并通过 `SQLBuilder` 将这些高级操作“翻译”为带有向量扩展（VSAG/HNSW）和全文索引能力的 SQL 语句。其核心亮点在于对 **混合检索（Hybrid Search）** 的原生支持以及类 MongoDB 的过滤语法支持。
