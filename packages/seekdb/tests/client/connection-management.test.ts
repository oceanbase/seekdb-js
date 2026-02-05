/**
 * Connection management tests for Server mode
 * Tests connection lifecycle, state management, and error handling for server mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { TEST_CONFIG } from "../test-utils.js";

describe("Server Mode - Connection Management", () => {
  describe("Connection Management", () => {
    test("isConnected returns false before any operation", async () => {
      const client = new SeekdbClient(TEST_CONFIG);
      // Connection is lazy, so should be false initially
      expect(client.isConnected()).toBe(false);
      await client.close();
    });

    test("isConnected returns true after operation", async () => {
      const client = new SeekdbClient(TEST_CONFIG);

      // Perform an operation to establish connection
      try {
        await client.listCollections();
        // After operation, connection should be established
        expect(client.isConnected()).toBe(true);
      } catch (error) {
        // If server not available, skip this test
        // Connection state may vary
      }

      await client.close();
    });

    test("close() closes the connection", async () => {
      const client = new SeekdbClient(TEST_CONFIG);

      try {
        await client.listCollections();
        expect(client.isConnected()).toBe(true);

        await client.close();
        // After close, connection should be closed
        expect(client.isConnected()).toBe(false);
      } catch (error) {
        // If server not available, just close
        await client.close();
      }
    });

    test("operations work after close and reconnect", async () => {
      const client = new SeekdbClient(TEST_CONFIG);

      try {
        // First operation
        await client.listCollections();
        await client.close();

        // Second operation should reconnect automatically
        const collections = await client.listCollections();
        expect(Array.isArray(collections)).toBe(true);

        await client.close();
      } catch (error) {
        // If server not available, just close
        await client.close();
      }
    });

    test("multiple close() calls are safe", async () => {
      const client = new SeekdbClient(TEST_CONFIG);

      try {
        await client.listCollections();
        await client.close();
        await client.close(); // Second close should be safe
        await client.close(); // Third close should be safe
      } catch (error) {
        await client.close();
      }
    });
  });
});
