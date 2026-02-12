/**
 * Factory functions tests (server mode only)
 * Embedded-related factory tests live in tests/embedded/client/factory-functions.test.ts
 */

import { describe, test, expect } from "vitest";
import { Client, AdminClient } from "../../src/factory.js";
import { SeekdbClient } from "../../src/client.js";

describe("Factory Functions", () => {
  describe("Client() Factory Function", () => {
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

    test("defaults to embedded mode when neither path nor host provided", async () => {
      const client = Client({} as any);
      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);
      try {
        await client.close();
      } catch (error) {
        // Ignore if embedded not available
      }
    });
  });

  describe("AdminClient() Factory Function", () => {
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
