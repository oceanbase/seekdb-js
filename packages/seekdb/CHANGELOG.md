# seekdb

## 1.1.1

### Patch Changes

- Fix some problems
  - @seekdb/default-embed@1.1.1

## 1.1.0

### Minor Changes

- Release Date: 2026-01-30
- Version: v1.1.0

## 📌 Highlights

- **More flexible Collection naming**: Maximum length increased from **64** to **512** characters, supporting more complex business scenarios.
- **Enhanced full-text search**: Introduces `FulltextAnalyzerConfig`, enabling custom analyzers and field mappings.
- **Major expansion of the embedding ecosystem**: Integrates **11** mainstream embedding providers, covering both open-source and commercial models.
- **Upgraded metadata persistence**: Embedding function information can be persisted into system tables, improving developer usability.
- **New table-fork capability**: Supports Collection-level snapshot copying, simplifying experiments and rollbacks.

## 🆕 New Features

### 1. Extended Collection name length

- **Relaxed limit**: Collection names now support **64–512** characters to accommodate longer naming conventions.
- **Compatibility**: Existing collections created with shorter names are unaffected.

### 2. Full-text search configuration (`FulltextAnalyzerConfig`)

- **New configuration structure**: The `createCollection` / `getOrCreateCollection` APIs can accept a `configuration` parameter. In addition to specifying HNSW index settings, you can now customize full-text index settings via `FulltextAnalyzerConfig`.

### 3. Expanded embedding function ecosystem

- Integrates **11** embedding functions across the following platforms:
  - **Open-source models**: sentence-transformers
  - **Commercial services**: OpenAI, Azure, AWS Bedrock, etc.

### 5. Table-Fork feature

- **Quickly create Collection snapshots**.
- **Use cases**:
  - A/B testing different index parameters
  - Data rollback and disaster recovery
- **Performance impact**: Fork is implemented with storage-level **copy-on-write (COW)** and completes in **< 1 second** (independent of data size).

## 1.0.0

### Major Changes

- Publish first major version.

### Minor Changes

- d3d9e5a: initial alpha release

### Patch Changes

- b8c457d: change package name
- d2d8bee: Added dimension check for the collection.add method & improve the vectorToString method
- dedb768: update readme.md
- 8f6a109: update tsup config and Readme.md

## 0.1.0-alpha.4

### Patch Changes

- Added dimension check for the collection.add method & improve the vectorToString method

## 0.1.0-alpha.3

### Patch Changes

- update Readme.md

## 0.1.0-alpha.2

### Patch Changes

- update tsup config and Readme.md

## 0.1.0-alpha.1

### Patch Changes

- change package name

## 0.1.0-alpha.1

### Patch Changes

- update readme.md

## 0.1.0-alpha.0

### Minor Changes

- initial alpha release
