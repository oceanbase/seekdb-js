/**
 * Key utilities
 */

import { KeyFactory } from "./types.js";

export class Key {
  public static readonly ID = new Key("#id");
  public static readonly DOCUMENT = new Key("#document");
  public static readonly EMBEDDING = new Key("#embedding");
  public static readonly METADATA = new Key("#metadata");
  public static readonly SPARSE_EMBEDDING = new Key("#sparseEmbedding");

  constructor(public readonly name: string) {}
}

const createKeyFactory = (): KeyFactory => {
  const factory = ((name: string) => new Key(name)) as KeyFactory;
  factory.ID = Key.ID;
  factory.DOCUMENT = Key.DOCUMENT;
  factory.EMBEDDING = Key.EMBEDDING;
  factory.METADATA = Key.METADATA;
  factory.SPARSE_EMBEDDING = Key.SPARSE_EMBEDDING;
  return factory;
};

export const K: KeyFactory = createKeyFactory();
