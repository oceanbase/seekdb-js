/**
 * Embedded mode - Admin database management (createDatabase, getDatabase, listDatabases, deleteDatabase).
 * Explicit createDatabase only; connect does NOT auto-create.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { AdminClient, Client } from "../../../src/factory.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";
import { SeekdbValueError } from "../../../src/errors.js";

const TEST_DB_DIR = getTestDbDir("admin-database.test.ts");

describe("Embedded Mode - Admin Database Management", () => {
  beforeAll(async () => {
    await cleanupTestDb("admin-database.test.ts");
  });

  afterAll(async () => {
    try {
      const admin = AdminClient({ path: TEST_DB_DIR });
      await admin.close();
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      // ignore
    }
  });

  test("AdminClient createDatabase creates a new database", async () => {
    const admin = AdminClient({ path: TEST_DB_DIR });
    await admin.createDatabase("admin_created_db_1");
    const db = await admin.getDatabase("admin_created_db_1");
    expect(db.name).toBe("admin_created_db_1");
    await admin.close();
  });

  test("AdminClient listDatabases includes created database and information_schema", async () => {
    const admin = AdminClient({ path: TEST_DB_DIR });
    const list = await admin.listDatabases();
    const names = list.map((d) => d.name);
    expect(names).toContain("admin_created_db_1");
    expect(names).toContain("information_schema");
    await admin.close();
  });

  test("AdminClient getDatabase throws for non-existent database", async () => {
    const admin = AdminClient({ path: TEST_DB_DIR });
    await expect(admin.getDatabase("nonexistent_db_xyz")).rejects.toThrow(
      SeekdbValueError,
    );
    await admin.close();
  });

  test("AdminClient deleteDatabase removes database", async () => {
    const admin = AdminClient({ path: TEST_DB_DIR });
    await admin.createDatabase("admin_to_delete_db");
    expect((await admin.listDatabases()).map((d) => d.name)).toContain(
      "admin_to_delete_db",
    );
    await admin.deleteDatabase("admin_to_delete_db");
    expect((await admin.listDatabases()).map((d) => d.name)).not.toContain(
      "admin_to_delete_db",
    );
    await expect(admin.getDatabase("admin_to_delete_db")).rejects.toThrow(
      SeekdbValueError,
    );
    await admin.close();
  });

  test("Client with non-existent database fails on first operation (no auto-create)", async () => {
    const admin = AdminClient({ path: TEST_DB_DIR });
    try {
      await admin.deleteDatabase("test_new_db");
    } catch {
      // ignore
    }
    await admin.close();
    const client = Client({ path: TEST_DB_DIR, database: "test_new_db" });
    await expect(client.listCollections()).rejects.toThrow();
    await client.close();
  });

  test("After createDatabase, Client can use the new database", async () => {
    const admin = AdminClient({ path: TEST_DB_DIR });
    await admin.createDatabase("test_use_after_create");
    await admin.close();
    const client = Client({
      path: TEST_DB_DIR,
      database: "test_use_after_create",
    });
    await client.listCollections();
    expect(client.isConnected()).toBe(true);
    await client.createCollection({
      name: "coll_in_new_db",
      configuration: { dimension: 3, distance: "l2" },
      embeddingFunction: null,
    });
    const list = await client.listCollections();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("coll_in_new_db");
    await client.close();
  });
});
