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
  name: string = "default-embed",
  config?: any,
): Promise<IEmbeddingFunction> {
  const finalConfig = config || ({} as any);

  // If the model is not registered, try to register it automatically (for built-in models)
  if (!registry.has(name)) {
    let ef: EmbeddingFunctionConstructor;
    try {
      ef = await import(`@seekdb/${name}`);
    } catch (error: any) {
      if (
        error.code === "MODULE_NOT_FOUND" ||
        error.message?.includes("Cannot find module")
      ) {
        throw new Error(
          `Embedding function '${name}' is not registered. \n\n` +
            `--- For seekdb built-in embedding function ---\n` +
            `  1. Install: npm install @seekdb/${name}\n` +
            `  2. Import: Add this at the top of your file: import '@seekdb/${name}';\n` +
            `The package will automatically register itself upon import.\n\n` +
            `--- For custom embedding function ---\n` +
            `Please implement the IEmbeddingFunction interface, then register it using 'registerEmbeddingFunction'. \n` +
            `You can see more details in the README.md of the package.`
        );
      }
      throw error;
    }
    // If the embedding function is not registered, register it
    if (ef && !registry.has(name)) {
      registry.set(name, ef);
    }
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
