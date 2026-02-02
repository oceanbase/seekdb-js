/**
 * Test utilities for embedded mode tests
 * Provides common configuration and helper functions
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";

// Base test database directory (relative path for normal runs; use path.resolve(process.cwd(), "seekdb.db") to verify absolute path with updated .so)
const TEST_DB_BASE_DIR = "./tests/embedded/seekdb.db";

/** When set (e.g. SEEKDB_EMBED_SAME_PATH=1), all embedded tests use the same path to verify no cross-path state. */
const USE_SAME_PATH = process.env.SEEKDB_EMBED_SAME_PATH === "1" || process.env.SEEKDB_EMBED_SAME_PATH === "true";

/**
 * Get test database directory for a specific test file
 * Each test file gets its own isolated database directory to avoid conflicts.
 * When SEEKDB_EMBED_SAME_PATH=1, all tests use TEST_DB_BASE_DIR (same path) for verification.
 */
export function getTestDbDir(testFileName: string): string {
  if (USE_SAME_PATH) return TEST_DB_BASE_DIR;
  const baseName = path.basename(testFileName, ".test.ts");
  return path.join(TEST_DB_BASE_DIR, baseName);
}

/**
 * Get embedded test config for use with new SeekdbClient(TEST_CONFIG).
 * Aligns with server tests which use new SeekdbClient(TEST_CONFIG).
 * For admin ops (createDatabase, listDatabases, etc.), embedded client uses built-in admin database internally.
 */
export function getEmbeddedTestConfig(testFileName: string): {
  path: string;
  database: string;
} {
  return { path: getTestDbDir(testFileName), database: "test" };
}

/** Base dir for absolute-path tests (same logical dir as relative, but absolute). */
const ABSOLUTE_TEST_DB_BASE_DIR = path.resolve(process.cwd(), "seekdb.db");

/**
 * Get test database directory as **absolute path** for a specific test file.
 * Used by absolute-path.test.ts to verify .so / C ABI with absolute path (SeekdbClient & AdminClient).
 * When SEEKDB_EMBED_SAME_PATH=1, all tests use ABSOLUTE_TEST_DB_BASE_DIR (same path).
 */
export function getAbsoluteTestDbDir(testFileName: string): string {
  if (USE_SAME_PATH) return ABSOLUTE_TEST_DB_BASE_DIR;
  const baseName = path.basename(testFileName, ".test.ts");
  return path.join(ABSOLUTE_TEST_DB_BASE_DIR, baseName);
}

/**
 * Get embedded test config with **absolute path** (for absolute-path-only tests).
 */
export function getEmbeddedTestConfigAbsolute(testFileName: string): {
  path: string;
  database: string;
} {
  return { path: getAbsoluteTestDbDir(testFileName), database: "test" };
}

/**
 * Clean up test database directory for absolute-path tests.
 */
export async function cleanupTestDbAbsolute(testFileName: string): Promise<void> {
  const testDbDir = getAbsoluteTestDbDir(testFileName);
  await waitForDbCleanup();
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fs.rm(testDbDir, { recursive: true, force: true });
      return;
    } catch (error: any) {
      if (attempt === maxRetries - 1) return;
      const delay = Math.min(100 * Math.pow(2, attempt), 1000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Wait for a short period to ensure database operations complete
 */
async function waitForDbCleanup(): Promise<void> {
  // Wait a bit to ensure database files are fully closed
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Clean up test database directory for a specific test file
 * Includes retry logic to handle cases where database is still closing
 */
export async function cleanupTestDb(testFileName: string): Promise<void> {
  const testDbDir = getTestDbDir(testFileName);

  // Wait a bit before attempting cleanup
  await waitForDbCleanup();

  // Retry cleanup with exponential backoff
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fs.rm(testDbDir, { recursive: true, force: true });
      // Success, exit retry loop
      return;
    } catch (error: any) {
      // If it's the last attempt, ignore the error
      if (attempt === maxRetries - 1) {
        // Ignore if directory doesn't exist or other errors on final attempt
        return;
      }
      // Wait before retry with exponential backoff
      const delay = Math.min(100 * Math.pow(2, attempt), 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use cleanupTestDb(testFileName) instead
 */
export const TEST_DB_DIR = TEST_DB_BASE_DIR;
