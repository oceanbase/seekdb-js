/** Shared demo data for seekdb-prisma examples. */
export const DEMO_IDS = ["u1", "u2", "u3"] as const;

export const DEMO_USERS = [
  { id: "u1", name: "Alice", email: "alice@example.com" },
  { id: "u2", name: "Bob", email: "bob@example.com" },
  { id: "u3", name: "Carol", email: "carol@example.com" },
] as const;

export const DEMO_DOCS = [
  "seekdb supports vector and hybrid search",
  "Prisma is an ORM for type-safe database access",
  "Use same database for vectors and relations",
] as const;

export const DEMO_DOCS_EMBEDDED = [
  "seekdb embedded is MySQL compatible",
  "Prisma driver adapter runs SQL in-process",
  "Vector and relational in one database file",
] as const;
