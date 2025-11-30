export interface EmbeddingConfig {
  [key: string]: any;
}

export interface IEmbeddingFunction {
  readonly name: string;
  generate(texts: string[]): Promise<number[][]>;
  getConfig(): EmbeddingConfig;
  dispose?(): Promise<void>;
}

export type EmbeddingFunctionConstructor = new (
  config: EmbeddingConfig,
) => IEmbeddingFunction;

const registry = new Map<string, EmbeddingFunctionConstructor>();

export const registerEmbeddingFunction = (
  name: string,
  fn: EmbeddingFunctionConstructor,
) => {
  if (registry.has(name)) {
    throw new Error(
      `Embedding function with name ${name} is already registered.`,
    );
  }
  registry.set(name, fn);
};

export async function getEmbeddingFunction(
  name: string = "embedding-default",
  config?: any,
): Promise<IEmbeddingFunction> {
  const finalConfig = config || ({} as any);
  // If the model is not registered, try to register it automatically (for built-in models)
  if (!registry.has(name)) {
    await import(`@seekdb/${name}`);
  }
  try {
    const Ctor = registry.get(name)!;
    if (!registry.has(name)) {
      throw new Error(`Embedding function '${name}' is not registered.`);
    }
    // Instantiate (if configuration is incorrect, the constructor will throw)
    return new Ctor(finalConfig);
  } catch (error) {
    throw new Error(
      `Failed to instantiate embedding function '${name}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
