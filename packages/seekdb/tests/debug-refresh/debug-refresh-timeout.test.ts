/**
 * DEBUG ONLY: reproduce the embedded refresh_index() 30s timeout seen on Linux CI.
 *
 * This test is intentionally focused:
 * - opens the embedded DB with SEEKDB_LOG_LEVEL=INFO so the change-stream
 *   (CSFetcher/CSWorker/dispatcher) INFO logs are written to seekdb.log;
 * - runs the exact collection API flow (create + add + refresh_index) that the
 *   failing tests use;
 * - when refresh_index() fails (the Linux symptom), prints the relevant lines of
 *   <dbDir>/log/seekdb.log so the CI log shows exactly where the change stream stalls.
 *
 * It is expected to FAIL on Linux and PASS on macOS. Remove after the root cause is fixed.
 */

// Must be set before the first seekdb client opens (the lib reads getenv() on open).
// DEBUG needed: change-stream FLOG_INFO lines are not emitted at INFO in this build.
process.env.SEEKDB_LOG_LEVEL = "DEBUG";

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { SeekdbClient } from "../../src/client.js";
import { generateCollectionName } from "../test-utils.js";
import {
  getEmbeddedTestConfig,
  cleanupTestDb,
} from "../embedded/test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("debug-refresh-timeout.test.ts");

async function printSeekdbLog() {
  const dbDir = TEST_CONFIG.path;
  const logPath = path.join(dbDir, "log", "seekdb.log");
  let content: string;
  try {
    content = await fs.readFile(logPath, "utf8");
  } catch (err) {
    console.log(
      `[debug-refresh] no seekdb.log at ${logPath}: ${(err as Error).message}`
    );
    return;
  }
  const lines = content.split("\n");
  console.log(`[debug-refresh] seekdb.log total lines: ${lines.length}`);
  // Persist a filtered copy outside the db dir so CI can upload it as an artifact.
  // Full DEBUG log is ~250MB; keep only lines relevant to the change-stream stall.
  const outPath = "tests/debug-refresh/seekdb-debug.log";
  try {
    const filteredLines = lines.filter(
      (l) =>
        /\] CSFetcher|\] CSWorker|CSDispatcher|CSChangeStream|change_stream_mgr|dbms_index|DBMSVector|refresh_index|refresh scn|refresh_scn|wait_refresh|VectorIndexScheduler|vector_index_scheduler|VEC_INDEX|ObVectorRefresh|batch processing failed|global abort|plugin process failed|plugin commit failed|failed to process tablet group|skip tablet group|write_to_vsag|insert_vector_index_log|resolve_table_id_from_tablet|TABLET_NOT_EXIST|replica readable|wait serial commit|batch failure detected|recovery complete|next_commit_sn|ObIDService|get_gts_sync|too slowly|create incr index|free memdata|delete vector index|mem_ctx|VsagMem|create_index|fail to create|hnsw param|adapter|Adaptor|adaptor|incr_data|switch_to_leader|resume.*async|async.*resume/i.test(
          l
        ) && !/get_index_prefix\(/.test(l)
    );
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, filteredLines.join("\n"));
    console.log(
      `[debug-refresh] filtered log (${filteredLines.length} lines) copied to ${outPath}`
    );
  } catch (err) {
    console.log(
      `[debug-refresh] failed to copy log: ${(err as Error).message}`
    );
  }
  // Focused view: change-stream + async-index failure markers.
  // DEBUG volume floods the file with TRACE noise, so match module prefixes tightly.
  const seen = new Map<string, number>();
  const interesting: string[] = [];
  for (const line of lines) {
    if (
      /\] CSFetcher|\] CSWorker|CSDispatcher|CSChangeStream|change_stream_mgr|dbms_index|DBMSVector|refresh_index|refresh scn|refresh_scn|wait_refresh|VectorIndexScheduler|vector_index_scheduler|VEC_INDEX|ObVectorRefresh|gts service advanced too slowly|ObIDService|get_gts_sync|batch processing failed|global abort|plugin process failed|plugin commit failed|failed to process tablet group|skip tablet group|write_to_vsag|insert_vector_index_log|resolve_table_id_from_tablet|TABLET_NOT_EXIST|replica readable|wait serial commit|batch failure detected|recovery complete|next_commit_sn|create incr index|free memdata|delete vector index|VsagMem|create_index|fail to create|incr_data|progress\(/i.test(
        line
      )
    ) {
      if (/waiting for change stream refresh scn/.test(line)) {
        seen.set(
          "waiting-for-refresh-scn",
          (seen.get("waiting-for-refresh-scn") ?? 0) + 1
        );
        continue;
      }
      interesting.push(line);
    }
  }
  for (const [key, count] of seen) {
    interesting.push(`[debug-refresh] (suppressed ${key} x${count})`);
  }
  // Print ALL interesting lines (usually < a few hundred).
  console.log(
    `[debug-refresh] === change-stream excerpt (${interesting.length} lines) ===`
  );
  for (const line of interesting) {
    // Drop the millisecond-precision timestamp prefix for readability.
    const cleaned = line.replace(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+\s*/,
      ""
    );
    console.log(`[dbg] ${cleaned}`);
  }
  console.log("[debug-refresh] === end of excerpt ===");
  // Raw tail fallback: whatever was last written to the file, unfiltered.
  const rawTail = lines.slice(-40);
  console.log(
    `[debug-refresh] === seekdb.log raw tail (${rawTail.length} lines) ===`
  );
  for (const line of rawTail) {
    const cleaned = line.replace(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+\s*/,
      ""
    );
    console.log(`[raw] ${cleaned}`);
  }
  console.log("[debug-refresh] === end of raw tail ===");
}

describe("DEBUG refresh_index timeout", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("debug-refresh-timeout.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    try {
      await client.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      // Ignore cleanup errors
    }
  });

  test("create + add + refresh_index reproduces the timeout", async () => {
    const collectionName = generateCollectionName("debug_refresh");
    // Version probe: confirms which refresh_index branch the client takes.
    try {
      const rows = await client.execute("SELECT VERSION() as v");
      console.log(
        `[debug-refresh] SELECT VERSION() => ${JSON.stringify(rows)}`
      );
    } catch (err) {
      console.log(`[debug-refresh] SELECT VERSION() failed: ${String(err)}`);
    }
    const collection = await client.createCollection({
      name: collectionName,
      configuration: { dimension: 3, distance: "l2" },
      embeddingFunction: null,
    });
    expect(collection).toBeDefined();

    await collection.add({
      ids: ["id1", "id2", "id3"],
      embeddings: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    });

    let refreshError: unknown = null;
    const startedAt = Date.now();
    try {
      await collection.refresh_index();
    } catch (err) {
      refreshError = err;
    }
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[debug-refresh] refresh_index returned in ${elapsedMs}ms, error=${String(refreshError)}`
    );

    await printSeekdbLog();

    // NOTE: a post-refresh query is intentionally NOT asserted here — on macOS the
    // index may legitimately not be searchable yet right after refresh, and the goal
    // of this test is only the refresh_index timeout + log capture.
    if (refreshError !== null) {
      throw refreshError;
    }

    await client.deleteCollection(collectionName);
  }, 120000); // allow up to 2 minutes for the 30s timeout + log read
});
