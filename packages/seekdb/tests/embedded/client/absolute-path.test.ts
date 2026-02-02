/**
 * Embedded mode - Absolute path verification for both SeekdbClient and AdminClient.
 * Verifies that .so / C ABI works correctly when path is absolute (path.resolve).
 * Run: pnpm --filter seekdb exec vitest run tests/embedded/client/absolute-path.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { AdminClient } from "../../../src/factory.js";
import {
  getEmbeddedTestConfigAbsolute,
  cleanupTestDbAbsolute,
} from "../test-utils.js";
import {
  generateCollectionName,
  generateDatabaseName,
} from "../../test-utils.js";

const TEST_FILE = "absolute-path.test.ts";
const TEST_CONFIG = getEmbeddedTestConfigAbsolute(TEST_FILE);

describe("Embedded Mode - Absolute Path (SeekdbClient & AdminClient)", () => {
  beforeAll(async () => {
    await cleanupTestDbAbsolute(TEST_FILE);
  });

  afterAll(async () => {
    try {
      await cleanupTestDbAbsolute(TEST_FILE);
    } catch {
      // ignore
    }
  });

  test("path is absolute", () => {
    const pathModule = require("node:path");
    expect(pathModule.isAbsolute(TEST_CONFIG.path)).toBe(true);
  });

  test("After createDatabase, SeekdbClient can use the new database", async () => {
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

  describe("Same path, multiple databases (absolute path)", () => {
    const DB_A = "abs_multi_db_a";
    const DB_B = "abs_multi_db_b";

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
  });
});
