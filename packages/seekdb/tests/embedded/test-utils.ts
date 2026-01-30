/**
 * Test utilities for embedded mode tests
 * Provides common configuration and helper functions
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";

// Base test database directory
const TEST_DB_BASE_DIR = "./seekdb.db";

/**
 * Get test database directory for a specific test file
 * Each test file gets its own isolated database directory to avoid conflicts
 */
export function getTestDbDir(testFileName: string): string {
    // Extract test file name without extension (e.g., "collection-get" from "collection-get.test.ts")
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
