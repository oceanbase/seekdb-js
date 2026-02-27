/** Shared demo data for seekdb-drizzle examples. */
export const DEMO_IDS = ["u1", "u2", "u3"] as const;

export const DEMO_USERS = [
  { id: "u1", name: "Alice", email: "alice@example.com" },
  { id: "u2", name: "Bob", email: "bob@example.com" },
  { id: "u3", name: "Carol", email: "carol@example.com" },
] as const;

export const DEMO_DOCS = [
  "seekdb is a vector database for semantic search",
  "Drizzle ORM is a type-safe SQL toolkit",
  "Combine vector search with relational data in one app",
] as const;

export const DEMO_DOCS_EMBEDDED = [
  "seekdb embedded is MySQL compatible",
  "Drizzle mysql-proxy runs SQL in-process",
  "Vector and relational in one database file",
] as const;
