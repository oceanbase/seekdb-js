/**
 * Embedded mode - Admin database management (createDatabase, getDatabase, listDatabases, deleteDatabase).
 * Same scenario as tests/client/admin-database.test.ts for Server mode.
 * Explicit createDatabase only; connect does NOT auto-create.
 * Also verifies same path, multiple databases (collections isolated per database).
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { AdminClient } from "../../../src/factory.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { Database } from "../../../src/database.js";
import {
  generateCollectionName,
  generateDatabaseName,
} from "../../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("admin-database.test.ts");

describe("Embedded Mode - Admin Database Management", () => {
  beforeAll(async () => {
    await cleanupTestDb("admin-database.test.ts");
  });

  afterAll(async () => {
    try {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      await admin.close();
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      // ignore
    }
  });

  test("AdminClient createDatabase creates a new database", async () => {
    const admin = AdminClient({ path: TEST_CONFIG.path });
    await admin.createDatabase("admin_created_db_1");
    const db = await admin.getDatabase("admin_created_db_1");
    expect(db.name).toBe("admin_created_db_1");
    await admin.close();
  });

  test("AdminClient listDatabases includes created database and information_schema", async () => {
    const admin = AdminClient({ path: TEST_CONFIG.path });
    const list = await admin.listDatabases();
    const names = list.map((d) => d.name);
    expect(names).toContain("admin_created_db_1");
    expect(names).toContain("information_schema");
    await admin.close();
  });

  test("AdminClient getDatabase throws for non-existent database", async () => {
    const admin = AdminClient({ path: TEST_CONFIG.path });
    await expect(admin.getDatabase("nonexistent_db_xyz")).rejects.toThrow(
      SeekdbValueError
    );
    await admin.close();
  });

  test("AdminClient deleteDatabase removes database", async () => {
    const admin = AdminClient({ path: TEST_CONFIG.path });
    await admin.createDatabase("admin_to_delete_db");
    expect((await admin.listDatabases()).map((d) => d.name)).toContain(
      "admin_to_delete_db"
    );
    await admin.deleteDatabase("admin_to_delete_db");
    expect((await admin.listDatabases()).map((d) => d.name)).not.toContain(
      "admin_to_delete_db"
    );
    await expect(admin.getDatabase("admin_to_delete_db")).rejects.toThrow(
      SeekdbValueError
    );
    await admin.close();
  });

  test("Client with non-existent database fails on first operation (no auto-create)", async () => {
    const admin = AdminClient({ path: TEST_CONFIG.path });
    try {
      await admin.deleteDatabase("test_new_db");
    } catch {
      // ignore
    }
    await admin.close();
    const client = new SeekdbClient({
      path: TEST_CONFIG.path,
      database: "test_new_db",
    });
    await expect(client.listCollections()).rejects.toThrow();
    await client.close();
  });

  test("After createDatabase, Client can use the new database", async () => {
    const dbName = generateDatabaseName("test_use_after_create");
    const collName = generateCollectionName("coll_in_new_db");
    const admin = AdminClient({ path: TEST_CONFIG.path });
    await admin.createDatabase(dbName);
    await admin.close();
    const client = new SeekdbClient({
      path: TEST_CONFIG.path,
      database: dbName,
    });
    await client.listCollections();
    expect(client.isConnected()).toBe(true);
    await client.createCollection({
      name: collName,
      configuration: { dimension: 3, distance: "l2" },
      embeddingFunction: null,
    });
    const list = await client.listCollections();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe(collName);
    await client.close();
  });

  describe("Admin database API (align with server)", () => {
    test("list databases with limit", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const limitedDbs = await admin.listDatabases(5);
      expect(limitedDbs.length).toBeLessThanOrEqual(5);
      expect(Array.isArray(limitedDbs)).toBe(true);
      await admin.close();
    });

    test("list databases with limit and offset", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const offsetDbs = await admin.listDatabases(2, 1);
      expect(offsetDbs.length).toBeLessThanOrEqual(2);
      expect(Array.isArray(offsetDbs)).toBe(true);
      await admin.close();
    });

    test("database object equals method works correctly", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const testDbName = generateDatabaseName("test_embed_db");
      await admin.createDatabase(testDbName);
      const db1 = await admin.getDatabase(testDbName);
      const db2 = await admin.getDatabase(testDbName);
      expect(db1.equals(db2)).toBe(true);
      await admin.deleteDatabase(testDbName);
      await admin.close();
    });

    test("database object toString method returns name", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const testDbName = generateDatabaseName("test_embed_db");
      await admin.createDatabase(testDbName);
      const db = await admin.getDatabase(testDbName);
      expect(db.toString()).toBe(testDbName);
      await admin.deleteDatabase(testDbName);
      await admin.close();
    });

    test("list databases with zero limit returns empty array", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const emptyDbs = await admin.listDatabases(0);
      expect(emptyDbs).toBeDefined();
      expect(Array.isArray(emptyDbs)).toBe(true);
      expect(emptyDbs.length).toBe(0);
      await admin.close();
    });

    test("list databases with offset beyond available returns empty array", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const allDbs = await admin.listDatabases();
      const offsetDbs = await admin.listDatabases(10, allDbs.length + 100);
      expect(offsetDbs).toBeDefined();
      expect(Array.isArray(offsetDbs)).toBe(true);
      expect(offsetDbs.length).toBe(0);
      await admin.close();
    });

    test("database object properties are correctly set", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const testDbName = generateDatabaseName("test_embed_props");
      await admin.createDatabase(testDbName);
      const db = await admin.getDatabase(testDbName);
      expect(db.name).toBe(testDbName);
      expect(db).toBeInstanceOf(Database);
      expect(typeof db.charset).toBe("string");
      expect(typeof db.collation).toBe("string");
      await admin.deleteDatabase(testDbName);
      await admin.close();
    });

    test("create and delete multiple databases in sequence", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const dbNames = [
        generateDatabaseName("test_seq_1"),
        generateDatabaseName("test_seq_2"),
        generateDatabaseName("test_seq_3"),
      ];
      for (const dbName of dbNames) {
        await admin.createDatabase(dbName);
        const db = await admin.getDatabase(dbName);
        expect(db.name).toBe(dbName);
      }
      const databases = await admin.listDatabases();
      const names = databases.map((d) => d.name);
      for (const dbName of dbNames) {
        expect(names).toContain(dbName);
      }
      for (const dbName of dbNames) {
        await admin.deleteDatabase(dbName);
      }
      const after = await admin.listDatabases();
      const afterNames = after.map((d) => d.name);
      for (const dbName of dbNames) {
        expect(afterNames).not.toContain(dbName);
      }
      await admin.close();
    });

    test("database equals method returns false for different databases", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const name1 = generateDatabaseName("test_embed_a");
      const name2 = generateDatabaseName("test_embed_b");
      await admin.createDatabase(name1);
      await admin.createDatabase(name2);
      const db1 = await admin.getDatabase(name1);
      const db2 = await admin.getDatabase(name2);
      expect(db1.equals(db2)).toBe(false);
      await admin.deleteDatabase(name1);
      await admin.deleteDatabase(name2);
      await admin.close();
    });

    test("delete database for non-existent is idempotent (no throw)", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const nonExistent = generateDatabaseName("non_existent");
      await expect(admin.deleteDatabase(nonExistent)).resolves.toBeUndefined();
      await admin.close();
    });

    test("create database twice is idempotent (no throw)", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      const testDbName = generateDatabaseName("test_dup");
      await admin.createDatabase(testDbName);
      await expect(admin.createDatabase(testDbName)).resolves.toBeUndefined();
      await admin.deleteDatabase(testDbName);
      await admin.close();
    });
  });

  describe("Same path, multiple databases", () => {
    const DB_A = "multi_db_a";
    const DB_B = "multi_db_b";

    afterAll(async () => {
      try {
        const admin = AdminClient({ path: TEST_CONFIG.path });
        try {
          await admin.deleteDatabase(DB_A);
        } catch {
          // ignore
        }
        try {
          await admin.deleteDatabase(DB_B);
        } catch {
          // ignore
        }
        await admin.close();
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        // ignore
      }
    });

    test("admin creates two databases on same path", async () => {
      const admin = AdminClient({ path: TEST_CONFIG.path });
      await admin.createDatabase(DB_A);
      await admin.createDatabase(DB_B);
      const list = await admin.listDatabases();
      const names = list.map((d) => d.name);
      expect(names).toContain(DB_A);
      expect(names).toContain(DB_B);
      expect(names).toContain("information_schema");
      await admin.close();
    });

    test("client on db_a creates collection, client on db_b creates collection", async () => {
      const clientA = new SeekdbClient({
        path: TEST_CONFIG.path,
        database: DB_A,
      });
      const clientB = new SeekdbClient({
        path: TEST_CONFIG.path,
        database: DB_B,
      });

      const nameA = generateCollectionName("coll_a");
      const nameB = generateCollectionName("coll_b");

      await clientA.createCollection({
        name: nameA,
        configuration: { dimension: 3, distance: "cosine" },
        embeddingFunction: null,
      });
      await clientB.createCollection({
        name: nameB,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const listA = await clientA.listCollections();
      const listB = await clientB.listCollections();

      expect(listA.length).toBe(1);
      expect(listA[0].name).toBe(nameA);
      expect(listB.length).toBe(1);
      expect(listB[0].name).toBe(nameB);

      await clientA.close();
      await clientB.close();
    });

    test("collections are isolated per database on same path", async () => {
      const clientA = new SeekdbClient({
        path: TEST_CONFIG.path,
        database: DB_A,
      });
      const clientB = new SeekdbClient({
        path: TEST_CONFIG.path,
        database: DB_B,
      });

      const listA = await clientA.listCollections();
      const listB = await clientB.listCollections();

      const namesA = listA.map((c) => c.name);
      const namesB = listB.map((c) => c.name);

      expect(namesA.every((n) => n.startsWith("coll_a_"))).toBe(true);
      expect(namesB.every((n) => n.startsWith("coll_b_"))).toBe(true);
      expect(namesA.some((n) => namesB.includes(n))).toBe(false);

      await clientA.close();
      await clientB.close();
    });

    test("default database (test) has no collections from db_a or db_b", async () => {
      const clientDefault = new SeekdbClient(TEST_CONFIG);
      const list = await clientDefault.listCollections();
      const names = list.map((c) => c.name);
      expect(names.some((n) => n.startsWith("coll_a_"))).toBe(false);
      expect(names.some((n) => n.startsWith("coll_b_"))).toBe(false);
      await clientDefault.close();
    });
  });
});
