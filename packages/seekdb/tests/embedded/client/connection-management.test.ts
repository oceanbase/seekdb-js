/**
 * Connection management tests for Embedded mode
 * Tests connection lifecycle, state management, and error handling for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client } from "../../../src/factory.js";
import { SeekdbClient } from "../../../src/client.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";

describe("Embedded Mode - Connection Management", () => {
  const TEST_DB_DIR = getTestDbDir("connection-management.test.ts");

  beforeAll(async () => {
    await cleanupTestDb("connection-management.test.ts");
  });

  test("isConnected returns false before any operation", async () => {
    const client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });

    // Connection is lazy, so should be false initially
    expect(client.isConnected()).toBe(false);
    await client.close();
  });

  test("isConnected returns true after operation", async () => {
    const client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });

    // Perform an operation to establish connection
    await client.listCollections();
    // After operation, connection should be established
    expect(client.isConnected()).toBe(true);

    await client.close();
  });

  test("close() is a no-op in embedded mode (no need to manually close)", async () => {
    const client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });

    await client.listCollections();
    expect(client.isConnected()).toBe(true);

    await client.close();
    // Embedded mode: close() is a no-op; connection state unchanged (unlike server mode)
    expect(client.isConnected()).toBe(true);
  });

  test("operations work after close and reconnect", async () => {
    const client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });

    // First operation
    await client.listCollections();
    await client.close();

    // Second operation should reconnect automatically
    const collections = await client.listCollections();
    expect(Array.isArray(collections)).toBe(true);

    await client.close();
  });

  test("multiple close() calls are safe", async () => {
    const client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });

    await client.listCollections();
    await client.close();
    await client.close(); // Second close should be safe
    await client.close(); // Third close should be safe
  });
});
