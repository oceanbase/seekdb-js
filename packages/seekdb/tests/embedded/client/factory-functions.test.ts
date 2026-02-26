/**
 * Factory functions tests (Client/AdminClient)
 * Lives under embedded/ because default path/host case requires native addon.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { Client, AdminClient } from "../../../src/factory.js";
import { SeekdbClient } from "../../../src/client.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";

const TEST_FILE = "factory-functions.test.ts";
const TEST_DB_DIR = getTestDbDir(TEST_FILE);

describe("Embedded Mode - Factory Functions", () => {
  beforeAll(async () => {
    await cleanupTestDb(TEST_FILE);
  });

  describe("Client() Factory Function", () => {
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

    test("defaults to embedded mode when neither path nor host provided", async () => {
      const client = Client({} as any);
      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);
      await client.close();
    });

    test("creates server client with host parameter", async () => {
      const client = Client({
        host: "127.0.0.1",
        port: 2881,
        user: "root",
        password: "",
        database: "test",
        tenant: "sys",
      });

      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);

      try {
        await client.close();
      } catch (error) {
        // Ignore if server not available
      }
    });

    test("creates server client with default values", async () => {
      const client = Client({
        host: "127.0.0.1",
        database: "test",
      });

      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);

      try {
        await client.close();
      } catch (error) {
        // Ignore if server not available
      }
    });
  });

  describe("AdminClient() Factory Function", () => {
    test("creates admin client with path parameter", async () => {
      const admin = AdminClient({
        path: TEST_DB_DIR,
      });

      expect(admin).toBeDefined();
      expect(admin instanceof SeekdbClient).toBe(true);

      await admin.close();
    });

    test("creates admin client with host parameter", async () => {
      const admin = AdminClient({
        host: "127.0.0.1",
        port: 2881,
        user: "root",
        password: "",
        tenant: "sys",
      });

      expect(admin).toBeDefined();
      expect(admin instanceof SeekdbClient).toBe(true);

      try {
        await admin.close();
      } catch (error) {
        // Ignore if server not available
      }
    });
  });

  describe("Factory Function Edge Cases", () => {
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

    test("Client() with custom charset", async () => {
      const client = Client({
        host: "127.0.0.1",
        port: 2881,
        user: "root",
        password: "",
        database: "test",
        charset: "utf8mb4",
      });

      expect(client).toBeDefined();

      try {
        await client.close();
      } catch (error) {
        // Ignore if server not available
      }
    });
  });
});
