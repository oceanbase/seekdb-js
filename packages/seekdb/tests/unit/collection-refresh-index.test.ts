import { describe, expect, test } from "vitest";
import { Collection } from "../../src/collection.js";
import type { IInternalClient } from "../../src/types.js";

function createCollectionWithExecute(
  execute: (
    sql: string,
    params?: unknown[]
  ) => Promise<Record<string, unknown>[] | null>
): Collection {
  const internalClient: IInternalClient = {
    isConnected: () => true,
    execute,
    close: async () => undefined,
  };

  return new Collection({
    name: "unit_refresh_index",
    client: {} as any,
    internalClient,
  });
}

describe("Collection.refresh_index", () => {
  test("no-ops when seekdb version is lower than 1.3.0", async () => {
    let refreshCalled = false;
    const collection = createCollectionWithExecute(async (sql: string) => {
      if (sql === "SELECT VERSION() AS version") {
        return [{ version: "seekdb-1.2.9" }];
      }
      if (sql === "CALL dbms_index_manager.refresh();") {
        refreshCalled = true;
      }
      return [];
    });

    await collection.refresh_index();
    expect(refreshCalled).toBe(false);
  });

  test("executes refresh when seekdb version is 1.3.0 or above", async () => {
    const sqlCalls: string[] = [];
    const collection = createCollectionWithExecute(async (sql: string) => {
      sqlCalls.push(sql);
      if (sql === "SELECT VERSION() AS version") {
        return [{ version: "seekdb-1.3.0" }];
      }
      return [];
    });

    await collection.refresh_index();
    await collection.refresh_index();

    expect(
      sqlCalls.filter((sql) => sql === "SELECT VERSION() AS version")
    ).toHaveLength(1);
    expect(
      sqlCalls.filter((sql) => sql === "CALL dbms_index_manager.refresh();")
    ).toHaveLength(2);
  });

  test("extracts seekdb version from OceanBase version string", async () => {
    let refreshCalled = false;
    const collection = createCollectionWithExecute(async (sql: string) => {
      if (sql === "SELECT VERSION() AS version") {
        return [{ version: "5.7.25-OceanBase seekdb-v1.3.0.0" }];
      }
      if (sql === "CALL dbms_index_manager.refresh();") {
        refreshCalled = true;
      }
      return [];
    });

    await collection.refresh_index();
    expect(refreshCalled).toBe(true);
  });
});
