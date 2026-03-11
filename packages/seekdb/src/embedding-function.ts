import {
  EmbeddingFunction,
  EmbeddingFunctionConstructor,
  SparseEmbeddingFunction,
  SparseEmbeddingFunctionConstructor,
} from "./types.js";

const DENSE_REGISTRY_KEY = "seekdb:embeddingFunctionRegistry";
const denseRegistry: Map<string, EmbeddingFunctionConstructor> =
  (globalThis as any)[DENSE_REGISTRY_KEY] ??
  ((globalThis as any)[DENSE_REGISTRY_KEY] = new Map());

const SPARSE_REGISTRY_KEY = "seekdb:sparseEmbeddingFunctionRegistry";
const sparseRegistry: Map<string, SparseEmbeddingFunctionConstructor> =
  (globalThis as any)[SPARSE_REGISTRY_KEY] ??
  ((globalThis as any)[SPARSE_REGISTRY_KEY] = new Map());

/**
 * Register a custom embedding function.
 *
 * @experimental This API is experimental and may change in future versions.
 * @param name - The name of the embedding function
 * @param fn - The embedding function constructor
 */
export const registerEmbeddingFunction = (
  name: string,
  fn: EmbeddingFunctionConstructor
) => {
  if (denseRegistry.has(name)) {
    throw new Error(
      `Embedding function with name ${name} is already registered.`
    );
  }
  denseRegistry.set(name, fn);
};

/**
 * Register a custom sparse embedding function.
 *
 * @experimental This API is experimental and may change in future versions.
 */
export const registerSparseEmbeddingFunction = (
  name: string,
  fn: SparseEmbeddingFunctionConstructor
) => {
  if (sparseRegistry.has(name)) {
    throw new Error(
      `Sparse embedding function with name ${name} is already registered.`
    );
  }
  sparseRegistry.set(name, fn);
};

/**
 * Check if an embedding function supports persistence (can be restored from config).
 *
 * An embedding function supports persistence if:
 * - It is not null/undefined
 * - It has a getConfig() method
 * - Its constructor has a buildFromConfig() static method
 * - Calling getConfig() does not throw an error
 *
 * @param ef - The embedding function to check
 * @returns true if the embedding function supports persistence
 */
export function supportsPersistence(
  ef: EmbeddingFunction | null | undefined
): ef is EmbeddingFunction {
  if (ef == null) {
    return false;
  }

  // Check if getConfig method exists
  if (typeof ef.getConfig !== "function") {
    return false;
  }

  // Check if constructor.buildFromConfig exists
  if (typeof (ef as any).constructor?.buildFromConfig !== "function") {
    return false;
  }

  // Try calling getConfig() to ensure it doesn't throw
  try {
    ef.getConfig();
    return true;
  } catch {
    return false;
  }
}

export function supportsSparsePersistence(
  ef: SparseEmbeddingFunction | null | undefined
): ef is SparseEmbeddingFunction {
  if (ef == null) return false;
  if (typeof ef.getConfig !== "function") return false;
  if (typeof (ef as any).constructor?.buildFromConfig !== "function")
    return false;
  try {
    ef.getConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an embedding function by name.
 *
 * @experimental This API is experimental and may change in future versions.
 * @param name - The name of the embedding function, defaults to "default-embed"
 * @param config - Optional configuration for the embedding function
 * @returns A promise that resolves to an EmbeddingFunction instance
 */
export async function getEmbeddingFunction(
  name: string = "default-embed",
  config?: any
): Promise<EmbeddingFunction> {
  const finalConfig = config || ({} as any);

  // If the model is not registered, try to register it automatically (for built-in models)
  if (!denseRegistry.has(name)) {
    try {
      await import(`@seekdb/${name}`);
    } catch (error: any) {
      throw new Error(`Embedding function '${name}' is not registered.`);
    }
  }
  try {
    if (!denseRegistry.has(name)) {
      throw new Error(
        `Embedding function '${name}' is not registered. \n\n` +
          `--- For seekdb built-in embedding function ---\n` +
          `  1. Install: npm install @seekdb/${name}\n` +
          `  2. Import: Add this at the top of your file: import '@seekdb/${name}';\n` +
          `The package will automatically register itself upon import.\n\n` +
          `--- For custom embedding function ---\n` +
          `Please create your own embedding function class that implements the EmbeddingFunction interface. \n` +
          `You can see more details in the README.md of the package.\n\n`
      );
    }
    const Ctor = denseRegistry.get(name)!;

    if (Ctor.buildFromConfig) {
      return Ctor.buildFromConfig(finalConfig);
    }
    // Instantiate (if configuration is incorrect, the constructor will throw)
    return new Ctor(finalConfig);
  } catch (error) {
    throw new Error(
      `Failed to instantiate embedding function '${name}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get a sparse embedding function by name.
 *
 * @experimental This API is experimental and may change in future versions.
 */
export async function getSparseEmbeddingFunction(
  name: string,
  config?: any
): Promise<SparseEmbeddingFunction> {
  const finalConfig = config || ({} as any);

  if (!sparseRegistry.has(name)) {
    try {
      await import(`@seekdb/${name}`);
    } catch (_err) {
      throw new Error(`Sparse embedding function '${name}' is not registered.`);
    }
  }

  if (!sparseRegistry.has(name)) {
    throw new Error(`Sparse embedding function '${name}' is not registered.`);
  }

  const Ctor = sparseRegistry.get(name)!;
  if (Ctor.buildFromConfig) {
    return Ctor.buildFromConfig(finalConfig);
  }
  return new Ctor(finalConfig);
}
