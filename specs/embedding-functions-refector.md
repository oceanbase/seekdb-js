# SeekDB Embedding System Architecture

## 1. 目录结构 (Directory Structure)

采用 Monorepo 结构，核心逻辑位于 `seekdb` 包中，具体的 Embedding 实现作为独立的包存在于 `packages/embeddings/` 目录下。

```text
seekdb/
├── packages/
│   ├── seekdb/                # SDK 主包
│   │   ├── src/
│   │   │   └── embedding-function.ts  # 核心定义：IEmbeddingFunction, Registry, getEmbeddingFunction
│   │   └── package.json
│   ├── embeddings/            # Embedding 实现包
│   │   ├── default/           # 默认模型实现 (@seekdb/default-embed)
│   │   │   ├── package.json
│   │   │   └── index.ts
│   │   └── openai/            # OpenAI 模型实现 (@seekdb/embedding-openai)
│   │       ├── package.json
│   │       └── index.ts
```

## 2. 核心接口定义与全局注册 (Core Interface & Global Registry)

所有定义位于 `packages/seekdb/src/embedding-function.ts`。

### 2.1 接口定义

`IEmbeddingFunction` 接口定义了 Embedding 函数必须实现的方法，增加了 `dispose` 方法用于资源清理。

```typescript
// packages/seekdb/src/embedding-function.ts

export interface EmbeddingConfig {
  [key: string]: any;
}

export interface IEmbeddingFunction {
  readonly name: string;
  generate(texts: string[]): Promise<number[][]>;
  getConfig(): EmbeddingConfig;
  dispose?(): Promise<void>;
}

export type EmbeddingFunctionConstructor = new (config: EmbeddingConfig) => IEmbeddingFunction;
```

### 2.2 全局注册与动态加载 (Registry & Dynamic Loading)

SDK 维护一个全局注册表。`getEmbeddingFunction` 支持动态导入（Dynamic Import），如果请求的模型尚未注册，会自动尝试 `import("@seekdb/${name}")`。

```typescript
// packages/seekdb/src/embedding-function.ts

// 注册表：存储 名称 -> 类构造函数
const registry = new Map<string, EmbeddingFunctionConstructor>();

/**
 * 注册 Embedding 模型
 * @param name 模型名称
 * @param fn 模型类构造函数
 */
export const registerEmbeddingFunction = (
  name: string,
  fn: EmbeddingFunctionConstructor,
) => {
  if (registry.has(name)) {
    throw new Error(`Embedding function with name ${name} is already registered.`);
  }
  registry.set(name, fn);
};

/**
 * 工厂方法：获取 Embedding Function 实例
 * 支持动态加载：如果未注册，尝试动态 import 包
 */
export async function getEmbeddingFunction(
  name: string = "default",
  config?: any,
): Promise<IEmbeddingFunction> {
  const finalConfig = config || ({} as any);
  
  // 如果未注册，尝试自动导入对应的包
  if (!registry.has(name)) {
    await import(`@seekdb/${name}`);
  }

  try {
    const Ctor = registry.get(name)!;
    if (!registry.has(name)) {
      throw new Error(`Embedding function '${name}' is not registered.`);
    }
    return new Ctor(finalConfig);
  } catch (error) {
    throw new Error(
      `Failed to instantiate embedding function '${name}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
```

## 3. 实现层 (Implementation Layer)

每种 Embedding Function 作为一个独立包，在入口文件底部执行注册。

### 3.1 默认实现 (`@seekdb/default-embed`)

位于 `packages/embeddings/default/index.ts`。

```typescript
import { IEmbeddingFunction, registerEmbeddingFunction } from "seekdb";

const embeddingFunctionName = "default";

export class DefaultEmbeddingFunction implements IEmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  // ...
}

// 自动注册
registerEmbeddingFunction(embeddingFunctionName, DefaultEmbeddingFunction);
```

### 3.2 OpenAI 实现 (`@seekdb/embedding-openai`)

位于 `packages/embeddings/openai/index.ts`。

```typescript
import { IEmbeddingFunction, registerEmbeddingFunction } from "seekdb";

const embeddingFunctionName = "embedding-openai";

export class OpenAIEmbeddingFunction implements IEmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  // ...
}

// 自动注册
registerEmbeddingFunction(embeddingFunctionName, OpenAIEmbeddingFunction);
```

## 4. 用户使用流程 (User Workflow)

### 4.1 创建 Collection (Create Collection)

用户可以显式实例化 Embedding Function，或者让 SDK 使用默认值。

```typescript
import { OpenAIEmbeddingFunction } from "@seekdb/embedding-openai";
import { Client } from "seekdb";

// 1. 用户显式实例化
const openaiEf = new OpenAIEmbeddingFunction({ apiKey: "sk-..." });

const client = new Client();
// 2. 传入实例
await client.createCollection({
  name: "my_collection",
  embeddingFunction: openaiEf
});
```

### 4.2 隐式加载 (Implicit Loading)

如果在创建 Collection 时未指定 `embeddingFunction`，SDK 将默认调用 `getEmbeddingFunction()`，这会尝试加载 `@seekdb/default-embed`。

```typescript
// 如果没有提供 embeddingFunction，默认加载 default
const collection = await client.createCollection({
  name: "default_collection"
});
```

## 5. Client 内部逻辑

`Client` 的 `createCollection` 和 `getCollection` 方法集成了 `getEmbeddingFunction`。

### 5.1 `createCollection` 逻辑

如果用户未提供 `embeddingFunction`，SDK 会异步调用 `getEmbeddingFunction()` 获取默认实现，并使用该实现来验证或推导 `dimension`。

### 5.2 `getCollection` 逻辑

目前 `getCollection` 同样支持传入 `embeddingFunction`。如果未传入（且未显式设为 null），它将尝试获取默认的 Embedding Function。

```typescript
// packages/seekdb/src/client.ts (逻辑摘要)

if (embeddingFunction === undefined) {
  // 异步获取默认 Embedding Function
  ef = await getEmbeddingFunction();
}
```
