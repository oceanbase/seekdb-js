/**
 * Relational schema for Drizzle (only relational tables; vector tables are managed by seekdb Collection).
 */
import { mysqlTable, varchar, int } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
});

export type User = typeof users.$inferSelect;
