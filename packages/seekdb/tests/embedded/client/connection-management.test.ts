/**
 * Connection management tests for Embedded mode
 * Tests connection lifecycle, state management, and error handling for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("connection-management.test.ts");

describe("Embedded Mode - Connection Management", () => {
  beforeAll(async () => {
    await cleanupTestDb("connection-management.test.ts");
  });

  test("isConnected returns false before any operation", async () => {
    const client = new SeekdbClient(TEST_CONFIG);

    // Connection is lazy, so should be false initially
    expect(client.isConnected()).toBe(false);
    await client.close();
  });

  test("isConnected returns true after operation", async () => {
    const client = new SeekdbClient(TEST_CONFIG);

    // Perform an operation to establish connection
    await client.listCollections();
    // After operation, connection should be established
    expect(client.isConnected()).toBe(true);

    await client.close();
  });

  test("close() is a no-op in embedded mode (no need to manually close)", async () => {
    const client = new SeekdbClient(TEST_CONFIG);

    await client.listCollections();
    expect(client.isConnected()).toBe(true);

    await client.close();
    // Embedded mode: close() is a no-op; connection state unchanged (unlike server mode)
    expect(client.isConnected()).toBe(true);
  });

  test("operations work after close and reconnect", async () => {
    const client = new SeekdbClient(TEST_CONFIG);

    // First operation
    await client.listCollections();
    await client.close();

    // Second operation should reconnect automatically
    const collections = await client.listCollections();
    expect(Array.isArray(collections)).toBe(true);

    await client.close();
  });

  test("multiple close() calls are safe", async () => {
    const client = new SeekdbClient(TEST_CONFIG);

    await client.listCollections();
    await client.close();
    await client.close(); // Second close should be safe
    await client.close(); // Third close should be safe
  });
});
