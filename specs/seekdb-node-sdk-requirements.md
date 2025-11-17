# SeekDB SDK Implementation Requirements

根据 pyseekdb 的文档（seekdb-docs目录）和源代码（pyseekdb-code）开发 Node.js SDK。


This document provides an in-depth analysis of the SeekDB JavaScript SDK implementation to serve as a reference for developing similar SDKs.

## Project Overview

### Basic Information

- **Package Name**: `seekdb`
- **Version**: 0.0.1
- **Language**: TypeScript
- **Build Tool**: tsup
- **Module System**: Supports both ESM and CJS
- **Node.js Requirement**: >= 20

### Project Structure

```
seekdb/
├── src/
│   ├── index.ts                    # Entry file, exports all public APIs
│   ├── seekdb-client.ts            # Main client class
│   ├── collection.ts              # Collection operations class
│   ├── admin-client.ts            # Admin client
│   ├── cloud-client.ts            # Cloud client
│   ├── types.ts                   # Type definitions
│   ├── errors.ts                  # Error class definitions
│   ├── utils.ts                   # Utility functions
│   ├── embedding-function.ts     # Embedding function interface
│   ├── seekdb-fetch.ts            # Custom fetch wrapper
│   ├── collection-configuration.ts # Collection configuration
│   ├── schema.ts                  # Schema definition
│   ├── next.ts                    # Next.js integration
│   ├── deno.ts                    # Deno compatibility
│   ├── cli.ts                     # CLI tools
│   ├── bindings.ts                # Native bindings
│   └── api/                       # Auto-generated API client
│       ├── client.gen.ts
│       ├── sdk.gen.ts
│       └── types.gen.ts
└── dist/                          # Build output
```

## Architecture Design

### 1. Layered Architecture

SeekDB SDK adopts a clear layered architecture:

1. Application Layer

2. Business Logic Layer
 - SeekDBClient
 - Collection
 - AdminClient

3. API Client Layer
 - @hey-api/client-fetch
 - Auto-generated API methods

4. Network Layer
 - seekdbFetch (custom fetch)
 - Error handling

### 2. Modular Design

- **Single Responsibility**: Each file is responsible for a clear functional area
- **Dependency Injection**: Dependencies injected through constructors for easy testing and extension
- **Interface Abstraction**: Use TypeScript interfaces to define contracts, supporting multiple implementations

## Core Components

### 1. SeekDBClient - Main Client

**Responsibilities**: Manage connections, collection operations, authentication

**Key Features**:

```typescript
export class SeekDBClient {
  private _tenant: string | undefined;
  private _database: string | undefined;
  private readonly apiClient: ReturnType<typeof createClient>;

  constructor(args: Partial<SeekDBClientArgs> = {}) {
    // 1. Parameter handling and defaults
    // 2. Backward compatibility handling (deprecated parameter warnings)
    // 3. Environment variable support
    // 4. API client initialization
  }

  // Core methods
  async createCollection(options): Promise<Collection>
  async getCollection(options): Promise<Collection>
  async listCollections(args?): Promise<Collection[]>
  async deleteCollection(options): Promise<void>
  async reset(): Promise<void>
}
```

**Design Highlights**:
- Supports environment variable configuration (`SEEKDB_TENANT`, `SEEKDB_DATABASE`)
- Backward compatibility handling (deprecated parameter warnings)
- Lazy path resolution (`_path()` method)
- Preflight check caching (`preflightChecks`)

### 2. Collection - Collection Operations

**Responsibilities**: Data CRUD, vector search

**Interface Design**:

```typescript
export interface Collection {
  id: string;
  name: string;
  metadata: CollectionMetadata | undefined;
  configuration: CollectionConfiguration;
  embeddingFunction?: EmbeddingFunction;
  schema?: Schema;

  // CRUD operations
  add(args): Promise<void>;
  get<TMeta>(args?): Promise<GetResult<TMeta>>;
  update(args): Promise<void>;
  delete(args): Promise<void>;

  // Query operations
  query(args): Promise<QueryResult>;
  peek(args?): Promise<GetResult>;
  count(): Promise<number>;
}
```

**Design Highlights**:
- Generic support (`<TMeta>` for type-safe metadata)
- Flexible query interface
- Automatic embedding processing
- Batch operation support

### 3. Error Handling System

**Error Class Hierarchy**:

```typescript
SeekDBError (base)
├── SeekDBConnectionError    # Connection errors
├── SeekDBServerError        # Server errors
├── SeekDBClientError        # Client errors
├── SeekDBUnauthorizedError  # Authentication errors
├── SeekDBForbiddenError     # Permission errors
├── SeekDBNotFoundError      # Resource not found
├── SeekDBValueError         # Value errors
├── InvalidCollectionError   # Invalid collection
└── InvalidArgumentError     # Invalid arguments
```

**Error Handling Strategy**:
- Custom error classes inheriting from `Error`
- Unified HTTP error handling in `seekdbFetch`
- Detailed error messages with error cause chains (`cause`)

### 4. EmbeddingFunction - Embedding Function Interface

**Interface Definition**:

```typescript
export interface EmbeddingFunction {
  generate(texts: string[]): Promise<number[][]>;
  generateForQueries?(texts: string[]): Promise<number[][]>;
  name?: string;
  defaultSpace?(): EmbeddingFunctionSpace;
  supportedSpaces?(): EmbeddingFunctionSpace[];
  buildFromConfig?(config: Record<string, any>): EmbeddingFunction;
  getConfig?(): Record<string, any>;
  validateConfigUpdate?(newConfig: Record<string, any>): void;
  validateConfig?(config: Record<string, any>): void;
}
```

**Design Highlights**:
- Extensible interface design
- Configuration serialization/deserialization support
- Query-specific embedding method (`generateForQueries`)
- Configuration validation mechanism

### 5. Custom Fetch Wrapper

**seekdbFetch Implementation**:

```typescript
export const seekdbFetch: typeof fetch = async (input, init) => {
  try {
    response = await fetch(input, init);
  } catch (err) {
    // Convert network errors to SeekDBConnectionError
    if (offlineError(err)) {
      throw new SeekDBConnectionError(...);
    }
  }

  // HTTP status code error handling
  if (!response.ok) {
    switch (response.status) {
      case 400: throw new SeekDBClientError(...);
      case 401: throw new SeekDBUnauthorizedError(...);
      case 403: throw new SeekDBForbiddenError(...);
      case 404: throw new SeekDBNotFoundError(...);
      // ...
    }
  }
  return response;
};
```

**Design Highlights**:
- Unified error transformation
- Special handling of network errors
- HTTP status code to error class mapping

## Design Patterns

### 1. Client Pattern

**Implementation**:
- Single entry point (`SeekDBClient`)
- Encapsulates all API calls
- Manages connection state and configuration

**Advantages**:
- Simplifies API usage
- Centralized configuration management
- Easy to add middleware and interceptors

### 2. Resource Pattern

**Implementation**:
- `Collection` as resource object
- Resource methods return resource instances
- Resource instances contain operation methods

**Example**:
```typescript
const collection = await client.getCollection({ name: "my_collection" });
await collection.add({ ids: ["1"], documents: ["text"] });
```

**Advantages**:
- Object-oriented API design
- Method chaining
- Resource state management

### 3. Factory Pattern

**Implementation**:
- `getEmbeddingFunction()` creates embedding functions based on configuration
- `Schema.deserializeFromJSON()` creates Schema instances

**Advantages**:
- Decouples creation logic
- Supports multiple implementations
- Configuration-driven instantiation

### 4. Adapter Pattern

**Implementation**:
- `seekdbFetch` adapts native `fetch`
- Environment compatibility layers (`deno.ts`, `next.ts`)

**Advantages**:
- Cross-platform compatibility
- Unified interface
- Feature enhancement

### 5. Strategy Pattern

**Implementation**:
- Pluggable `EmbeddingFunction`
- Different vector space calculation strategies

**Advantages**:
- Flexible extension
- Runtime strategy selection
- Easy to test

## Technical Implementation Details

### 1. API Client Generation

**Tech Stack**:
- `@hey-api/openapi-ts`: Generate TypeScript types from OpenAPI specifications
- `@hey-api/client-fetch`: Generate type-safe API client

**Workflow**:
```
OpenAPI Spec → Code Generation → API Client → Type Definitions
```

**Advantages**:
- Type safety
- Automatic API change synchronization
- Reduced manual maintenance cost

### 2. Type System Design

**Type Hierarchy**:
```typescript
// Basic types
Metadata = Record<string, any>
Where = { ... }
WhereDocument = { ... }

// Record types
RecordSet = {
  ids: string[];
  embeddings?: number[][];
  metadatas?: Metadata[];
  documents?: string[];
}

// Result types
GetResult<TMeta> = {
  ids: string[];
  embeddings?: number[][];
  metadatas?: TMeta[];
  documents?: string[];
}
```

**Design Principles**:
- Generics support type inference
- Optional fields use `?`
- Union types support multiple input formats

### 3. Serialization/Deserialization

**Metadata Serialization**:
```typescript
// Serialize: Object → JSON string
serializeMetadata(metadata: Metadata): string

// Deserialize: JSON string → Object
deserializeMetadata(metadata: string): Metadata
```

**Design Considerations**:
- Handle special values (`null`, `undefined`)
- Support nested objects
- Type-safe conversion

### 4. Validation Mechanism

**Validation Functions**:
```typescript
validateRecordSetLengthConsistency(recordSet)
validateIDs(ids)
validateWhere(where)
validateMetadata(metadata)
validateMaxBatchSize(batchSize)
```

**Validation Strategy**:
- Input validation at method entry
- Clear error messages
- Fail-fast approach

### 5. Build Configuration

**tsup Configuration** (inferred from package.json):
- Multi-format output (ESM, CJS)
- TypeScript declaration file generation
- Code splitting and optimization

**Export Configuration**:
```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/seekdb.d.ts",
        "default": "./dist/seekdb.mjs"
      },
      "require": {
        "types": "./dist/cjs/seekdb.d.cts",
        "default": "./dist/cjs/seekdb.cjs"
      }
    }
  }
}
```

**Advantages**:
- Supports both ESM and CJS
- Separate type definitions
- Conditional exports

## Best Practices Summary

### 1. Project Organization

✅ **Recommended**:
- Clear directory structure
- Single responsibility principle
- Modular design
- Unified naming conventions

❌ **Avoid**:
- Overly deep nesting
- Circular dependencies
- Files with unclear responsibilities

### 2. Type Design

✅ **Recommended**:
- Use TypeScript strict mode
- Generics for type flexibility
- Interface definitions for contracts
- Export types for user consumption

❌ **Avoid**:
- Overuse of `any`
- Incomplete type definitions
- Missing JSDoc comments

### 3. Error Handling

✅ **Recommended**:
- Custom error classes
- Error class hierarchy
- Detailed error messages
- Error cause chains (`cause`)

❌ **Avoid**:
- Throwing raw errors
- Unclear error messages
- Missing error types

### 4. API Design

✅ **Recommended**:
- Consistent naming conventions
- Use objects for optional parameters
- Method chaining
- Backward compatibility

❌ **Avoid**:
- Parameter order dependencies
- Breaking changes
- Inconsistent API styles

### 5. Configuration Management

✅ **Recommended**:
- Environment variable support
- Provide defaults
- Configuration validation
- Backward compatibility warnings

❌ **Avoid**:
- Hardcoded configurations
- Missing defaults
- Insufficient configuration validation

### 6. Testing Strategy

✅ **Recommended**:
- Unit tests covering core logic
- Integration tests verifying APIs
- Mock external dependencies
- Test utility functions

### 7. Documentation and Comments

✅ **Recommended**:
- JSDoc comments for all public APIs
- README with usage examples
- Self-documenting type definitions
- Clear error messages

### 8. Build and Publishing

✅ **Recommended**:
- Multi-format output (ESM/CJS)
- Type definition files
- Version management
- Testing before publishing

## Reference Recommendations for Developing Similar SDKs

### 1. Project Initialization

```bash
# Create project
npm init -y

# Install dependencies
npm install -D typescript tsup @types/node
npm install @hey-api/client-fetch @hey-api/openapi-ts
```

### 2. Suggested Directory Structure

```
src/
├── index.ts              # Entry file
├── client.ts             # Main client
├── resource.ts           # Resource class
├── types.ts              # Type definitions
├── errors.ts             # Error classes
├── utils.ts              # Utility functions
├── api/                  # Generated API client
└── config.ts             # Configuration
```

### 3. Core Class Template

```typescript
// client.ts
export class MyClient {
  private readonly apiClient: ReturnType<typeof createClient>;

  constructor(args: ClientArgs = {}) {
    const config = {
      baseUrl: args.baseUrl || defaultBaseUrl,
      headers: args.headers || {},
    };
    this.apiClient = createClient(createConfig(config));
    this.apiClient.setConfig({ fetch: customFetch });
  }

  async getResource(name: string): Promise<Resource> {
    const { data } = await Api.getResource({
      client: this.apiClient,
      path: { name },
    });
    return new ResourceImpl({ client: this, data });
  }
}
```

### 4. Error Handling Template

```typescript
// errors.ts
export class MyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class MyConnectionError extends MyError {}
export class MyClientError extends MyError {}
export class MyServerError extends MyError {}
```

### 5. Custom Fetch Template

```typescript
// custom-fetch.ts
export const customFetch: typeof fetch = async (input, init) => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    throw new MyConnectionError("Connection failed", err);
  }

  if (!response.ok) {
    const error = await parseError(response);
    throw mapStatusToError(response.status, error);
  }

  return response;
};
```

## Summary

The SeekDB SDK implementation demonstrates best practices for modern TypeScript SDK development:

1. **Clear Architecture**: Layered design, modularity, single responsibility
2. **Type Safety**: Complete TypeScript type system
3. **Error Handling**: Unified error handling mechanism
4. **Extensibility**: Interface abstraction, strategy patterns
5. **Developer Experience**: Auto-generated API client, clear documentation
6. **Compatibility**: Multi-format output, environment adaptation

These design patterns and best practices can be directly applied to similar SDK development, helping to build high-quality, maintainable client libraries.

