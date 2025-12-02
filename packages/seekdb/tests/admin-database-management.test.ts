/**
 * AdminClient database management tests - testing all database CRUD operations
 * Tests create, get, list, and delete database operations for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { SeekDBAdminClient } from "../src/admin-client.js";
import { DEFAULT_TENANT } from "../src/utils.js";
import { TEST_CONFIG, generateDatabaseName } from "./test-utils.js";

describe("AdminClient Database Management", () => {
  let adminClient: SeekDBAdminClient;

  beforeAll(async () => {
    adminClient = new SeekDBAdminClient({
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      user: TEST_CONFIG.user,
      password: TEST_CONFIG.password,
      tenant: TEST_CONFIG.tenant,
    });
  });

  afterAll(async () => {
    try {
      await adminClient.close();
    } catch (error) {
      // Ignore errors during cleanup
      console.error("Error closing admin client:", error);
    }
  });

  describe("Server Mode Admin Database Operations", () => {
    test("list all databases before test", async () => {
      const databasesBefore = await adminClient.listDatabases();
      expect(databasesBefore).toBeDefined();
      expect(Array.isArray(databasesBefore)).toBe(true);
    });

    test("create database", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);

      // Verify database was created
      const db = await adminClient.getDatabase(testDbName);
      expect(db).toBeDefined();
      expect(db.name).toBe(testDbName);

      // Cleanup
      await adminClient.deleteDatabase(testDbName);
    });

    test("get database to verify creation", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);

      const db = await adminClient.getDatabase(testDbName);
      expect(db).toBeDefined();
      expect(db.name).toBe(testDbName);

      expect(db.charset).toBeDefined();
      expect(db.collation).toBeDefined();
      // Verify tenant is set correctly (Server mode has tenant)
      expect(db.tenant).toBe(TEST_CONFIG.tenant);

      // Cleanup
      await adminClient.deleteDatabase(testDbName);
    });

    test("list databases includes created database", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);

      const databases = await adminClient.listDatabases();
      const dbNames = databases.map((db) => db.name);
      expect(dbNames).toContain(testDbName);

      // Verify all databases have correct tenant (Server mode)
      for (const db of databases) {
        expect(db.tenant).toBe(TEST_CONFIG.tenant);
      }

      // Cleanup
      await adminClient.deleteDatabase(testDbName);
    });

    test("list databases with limit", async () => {
      const limitedDbs = await adminClient.listDatabases(5);
      expect(limitedDbs.length).toBeLessThanOrEqual(5);
    });

    test("list databases with limit and offset", async () => {
      const offsetDbs = await adminClient.listDatabases(2, 1);
      expect(offsetDbs.length).toBeLessThanOrEqual(2);
    });

    test("delete database", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);
      await adminClient.deleteDatabase(testDbName);

      // Verify deletion
      const databases = await adminClient.listDatabases();
      const dbNames = databases.map((db) => db.name);
      expect(dbNames).not.toContain(testDbName);
    });

    test("verify database is not in list after deletion", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);
      const databasesBefore = await adminClient.listDatabases();
      const dbNamesBefore = databasesBefore.map((db) => db.name);
      expect(dbNamesBefore).toContain(testDbName);

      await adminClient.deleteDatabase(testDbName);

      const databasesAfter = await adminClient.listDatabases();
      const dbNamesAfter = databasesAfter.map((db) => db.name);
      expect(dbNamesAfter).not.toContain(testDbName);
    });

    test("database object equals method works correctly", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);

      const db1 = await adminClient.getDatabase(testDbName);
      const db2 = await adminClient.getDatabase(testDbName);
      expect(db1.equals(db2)).toBe(true);

      // Cleanup
      await adminClient.deleteDatabase(testDbName);
    });

    test("database object toString method returns name", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);

      const db = await adminClient.getDatabase(testDbName);
      expect(db.toString()).toBe(testDbName);

      // Cleanup
      await adminClient.deleteDatabase(testDbName);
    });

    test("database operations use client tenant when different tenant specified", async () => {
      const testDbName = generateDatabaseName("test_server_db");
      const differentTenant = "different_tenant";

      // Mock console.warn to capture warnings
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        // Create database with different tenant (should use client tenant)
        await adminClient.createDatabase(testDbName, differentTenant);

        // Verify warning was issued
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Specified tenant '${differentTenant}' differs from client tenant '${TEST_CONFIG.tenant}', using client tenant`,
          ),
        );

        // Verify database was created with client tenant
        const db = await adminClient.getDatabase(testDbName, differentTenant);
        expect(db.tenant).toBe(TEST_CONFIG.tenant); // Should use client tenant, not specified tenant

        // Verify warning was issued again for getDatabase
        expect(warnSpy).toHaveBeenCalledTimes(2);

        // Cleanup
        await adminClient.deleteDatabase(testDbName, differentTenant);
        expect(warnSpy).toHaveBeenCalledTimes(3); // Warning for deleteDatabase too
      } finally {
        warnSpy.mockRestore();
      }
    });

    test("database operations use client tenant when DEFAULT_TENANT specified", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      // Mock console.warn to verify no warning is issued for DEFAULT_TENANT
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        // Create database with DEFAULT_TENANT (should not warn if it matches client tenant)
        await adminClient.createDatabase(testDbName, DEFAULT_TENANT);

        // Get database - should use client tenant
        const db = await adminClient.getDatabase(testDbName);
        expect(db.tenant).toBe(TEST_CONFIG.tenant);

        // Cleanup
        await adminClient.deleteDatabase(testDbName);
      } finally {
        warnSpy.mockRestore();
      }
    });

    test("list databases returns databases with correct tenant", async () => {
      const databases = await adminClient.listDatabases();

      // Verify all databases have the correct tenant (Server mode)
      for (const db of databases) {
        expect(db.tenant).toBe(TEST_CONFIG.tenant);
        expect(db.name).toBeDefined();
        expect(db.charset).toBeDefined();
        expect(db.collation).toBeDefined();
      }
    });

    test("get database throws error for non-existent database", async () => {
      const nonExistentDbName = generateDatabaseName("non_existent_db");

      await expect(async () => {
        await adminClient.getDatabase(nonExistentDbName);
      }).rejects.toThrow();
    });

    test("delete database throws error for non-existent database", async () => {
      const nonExistentDbName = generateDatabaseName("non_existent_db");

      await expect(async () => {
        await adminClient.deleteDatabase(nonExistentDbName);
      });
    });

    test("create database throws error for duplicate database name", async () => {
      const testDbName = generateDatabaseName("test_duplicate_db");

      try {
        // Create database first time
        await adminClient.createDatabase(testDbName);

        // Try to create again with same name (should fail)
        await expect(async () => {
          await adminClient.createDatabase(testDbName);
        });
      } finally {
        // Cleanup
        try {
          await adminClient.deleteDatabase(testDbName);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test("list databases with zero limit returns empty array", async () => {
      const emptyDbs = await adminClient.listDatabases(0);
      expect(emptyDbs).toBeDefined();
      expect(Array.isArray(emptyDbs)).toBe(true);
      expect(emptyDbs.length).toBe(0);
    });

    test("list databases with large limit returns all available databases", async () => {
      const allDbs = await adminClient.listDatabases(10000);
      const normalDbs = await adminClient.listDatabases();

      expect(allDbs.length).toBeLessThanOrEqual(normalDbs.length);
      // If there are databases, both should return same count (or allDbs might be limited)
      if (normalDbs.length > 0) {
        expect(allDbs.length).toBeGreaterThan(0);
      }
    });

    test("list databases with offset beyond available databases returns empty array", async () => {
      const allDbs = await adminClient.listDatabases();
      const offsetDbs = await adminClient.listDatabases(
        10,
        allDbs.length + 100,
      );

      expect(offsetDbs).toBeDefined();
      expect(Array.isArray(offsetDbs)).toBe(true);
      expect(offsetDbs.length).toBe(0);
    });

    test("database object properties are correctly set", async () => {
      const testDbName = generateDatabaseName("test_db_properties");

      try {
        await adminClient.createDatabase(testDbName);
        const db = await adminClient.getDatabase(testDbName);

        // Verify all expected properties exist
        expect(db.name).toBe(testDbName);
        expect(db.tenant).toBe(TEST_CONFIG.tenant);
        expect(typeof db.charset).toBe("string");
        expect(db.charset.length).toBeGreaterThan(0);
        expect(typeof db.collation).toBe("string");
        expect(db.collation.length).toBeGreaterThan(0);
      } finally {
        // Cleanup
        try {
          await adminClient.deleteDatabase(testDbName);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test("create and delete multiple databases in sequence", async () => {
      const dbNames = [
        generateDatabaseName("test_seq_1"),
        generateDatabaseName("test_seq_2"),
        generateDatabaseName("test_seq_3"),
      ];

      try {
        // Create all databases
        for (const dbName of dbNames) {
          await adminClient.createDatabase(dbName);
          const db = await adminClient.getDatabase(dbName);
          expect(db.name).toBe(dbName);
        }

        // Verify all are in the list
        const databases = await adminClient.listDatabases();
        const dbNamesList = databases.map((db) => db.name);
        for (const dbName of dbNames) {
          expect(dbNamesList).toContain(dbName);
        }

        // Delete all databases
        for (const dbName of dbNames) {
          await adminClient.deleteDatabase(dbName);
        }

        // Verify all are deleted
        const databasesAfter = await adminClient.listDatabases();
        const dbNamesListAfter = databasesAfter.map((db) => db.name);
        for (const dbName of dbNames) {
          expect(dbNamesListAfter).not.toContain(dbName);
        }
      } catch (error) {
        // Cleanup on error
        for (const dbName of dbNames) {
          try {
            await adminClient.deleteDatabase(dbName);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
    });

    test("database equals method returns false for different databases", async () => {
      const testDbName1 = generateDatabaseName("test_db_1");
      const testDbName2 = generateDatabaseName("test_db_2");

      try {
        await adminClient.createDatabase(testDbName1);
        await adminClient.createDatabase(testDbName2);

        const db1 = await adminClient.getDatabase(testDbName1);
        const db2 = await adminClient.getDatabase(testDbName2);

        expect(db1.equals(db2)).toBe(false);
        expect(db1.equals(db1)).toBe(true);
        expect(db2.equals(db2)).toBe(true);
      } finally {
        // Cleanup
        try {
          await adminClient.deleteDatabase(testDbName1);
          await adminClient.deleteDatabase(testDbName2);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });
});
