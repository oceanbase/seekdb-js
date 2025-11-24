/**
 * AdminClient database management tests - testing all database CRUD operations
 * Tests create, get, list, and delete database operations for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekDBAdminClient } from "../src/admin-client.js";
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

      // Cleanup
      await adminClient.deleteDatabase(testDbName);
    });

    test("list databases includes created database", async () => {
      const testDbName = generateDatabaseName("test_server_db");

      await adminClient.createDatabase(testDbName);

      const databases = await adminClient.listDatabases();
      const dbNames = databases.map((db) => db.name);
      expect(dbNames).toContain(testDbName);

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
  });
});
