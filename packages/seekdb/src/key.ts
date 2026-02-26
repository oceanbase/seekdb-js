/**
 * Key utilities (Chroma-style).
 *
 * Note:
 * - `K.SPARSE_EMBEDDING.name` is the logical key "sparseEmbedding".
 * - It maps to the SQL column name `sparse_embedding` in SeekDB.
 */

export class Key {
  public static readonly ID = new Key("#id");
  public static readonly DOCUMENT = new Key("#document");
  public static readonly EMBEDDING = new Key("#embedding");
  public static readonly METADATA = new Key("#metadata");
  public static readonly SPARSE_EMBEDDING = new Key("sparseEmbedding");

  constructor(public readonly name: string) {}
}

export interface KeyFactory {
  (name: string): Key;
  ID: Key;
  DOCUMENT: Key;
  EMBEDDING: Key;
  METADATA: Key;
  SPARSE_EMBEDDING: Key;
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
