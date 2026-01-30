/**
 * Factory functions tests
 * Tests Client() and AdminClient() factory functions with various parameter combinations
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client, AdminClient } from "../../src/factory.js";
import { SeekdbClient } from "../../src/client.js";
import { getTestDbDir, cleanupTestDb } from "../embedded/test-utils.js";

describe("Factory Functions", () => {
  const TEST_DB_DIR = getTestDbDir("factory-functions.test.ts");

  beforeAll(async () => {
    await cleanupTestDb("factory-functions.test.ts");
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

    test("throws error when neither path nor host provided", async () => {
      await expect(async () => {
        Client({} as any);
      }).rejects.toThrow();
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
      // Should be embedded mode (path takes precedence)
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
