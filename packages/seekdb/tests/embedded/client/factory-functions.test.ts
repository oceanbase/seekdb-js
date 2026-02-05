/**
 * Embedded mode - Factory functions (Client/AdminClient with path only)
 * Covers same scenarios as server factory-functions.test.ts for embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client, AdminClient } from "../../../src/factory.js";
import { SeekdbClient } from "../../../src/client.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";

const TEST_FILE = "factory-functions.test.ts";
const TEST_DB_DIR = getTestDbDir(TEST_FILE);

describe("Embedded Mode - Factory Functions", () => {
  beforeAll(async () => {
    await cleanupTestDb(TEST_FILE);
  });

  describe("Client() Factory Function (embedded)", () => {
    test("creates embedded client with path parameter", async () => {
      const client = Client({
        path: TEST_DB_DIR,
        database: "test",
      });

      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);
      expect(client.isConnected()).toBe(false);

      await client.close();
    });

    test("creates embedded client with default database", async () => {
      const client = Client({
        path: TEST_DB_DIR,
      });

      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);

      await client.close();
    });

    test("with no path/host uses default embedded path and returns client", () => {
      const client = Client({} as any);
      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);
      client.close();
    });
  });

  describe("AdminClient() Factory Function (embedded)", () => {
    test("creates admin client with path parameter", async () => {
      const admin = AdminClient({
        path: TEST_DB_DIR,
      });

      expect(admin).toBeDefined();
      expect(admin instanceof SeekdbClient).toBe(true);

      await admin.close();
    });
  });

  describe("Factory Function Edge Cases (embedded)", () => {
    test("Client() with both path and host prefers path (embedded mode)", async () => {
      const client = Client({
        path: TEST_DB_DIR,
        host: "127.0.0.1",
        database: "test",
      });

      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);
      expect(client.isConnected()).toBe(false);

      await client.close();
    });
  });
});
