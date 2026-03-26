import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaSeekdb } from "../src/index.js";
import type { SeekdbClientLike } from "../src/adapter.js";

describe("PrismaSeekdbAdapterFactory", () => {
  let mockClient: SeekdbClientLike;

  beforeEach(() => {
    mockClient = {
      execute: vi.fn(),
    };
  });

  it("has correct provider and adapterName", async () => {
    const factory = new PrismaSeekdb(mockClient);
    expect(factory.provider).toBe("mysql");
    expect(factory.adapterName).toBe("@seekdb/prisma-adapter");

    const adapter = await factory.connect();
    expect(adapter.provider).toBe("mysql");
    expect(adapter.adapterName).toBe("@seekdb/prisma-adapter");
  });

  it("queryRaw returns empty result when execute returns null", async () => {
    vi.mocked(mockClient.execute).mockResolvedValue(null);
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    const result = await adapter.queryRaw({
      sql: "SELECT 1",
      args: [],
      argTypes: [],
    });

    expect(result).toEqual({
      columnNames: [],
      columnTypes: [],
      rows: [],
    });
    expect(mockClient.execute).toHaveBeenCalledWith("SELECT 1", undefined);
  });

  it("queryRaw returns empty result when execute returns empty array", async () => {
    vi.mocked(mockClient.execute).mockResolvedValue([]);
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    const result = await adapter.queryRaw({
      sql: "SELECT * FROM empty",
      args: [],
      argTypes: [],
    });

    expect(result).toEqual({
      columnNames: [],
      columnTypes: [],
      rows: [],
    });
  });

  it("queryRaw maps rows to SqlResultSet format", async () => {
    vi.mocked(mockClient.execute).mockResolvedValue([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ] as Record<string, unknown>[]);
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    const result = await adapter.queryRaw({
      sql: "SELECT id, name FROM users",
      args: [],
      argTypes: [],
    });

    expect(result.columnNames).toEqual(["id", "name"]);
    expect(result.columnTypes).toHaveLength(2);
    expect(result.rows).toEqual([
      [1, "Alice"],
      [2, "Bob"],
    ]);
    expect(mockClient.execute).toHaveBeenCalledWith(
      "SELECT id, name FROM users",
      undefined
    );
  });

  it("queryRaw passes args to execute", async () => {
    vi.mocked(mockClient.execute).mockResolvedValue([{ id: 1 }] as Record<
      string,
      unknown
    >[]);
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    await adapter.queryRaw({
      sql: "SELECT * FROM users WHERE id = ?",
      args: ["u1"],
      argTypes: [{ scalarType: "string", arity: "scalar" }],
    });

    expect(mockClient.execute).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE id = ?",
      ["u1"]
    );
  });

  it("executeRaw calls execute and returns 0", async () => {
    vi.mocked(mockClient.execute).mockResolvedValue(null);
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    const affected = await adapter.executeRaw({
      sql: "INSERT INTO users (id) VALUES (?)",
      args: ["u1"],
      argTypes: [],
    });

    expect(affected).toBe(0);
    expect(mockClient.execute).toHaveBeenCalledWith(
      "INSERT INTO users (id) VALUES (?)",
      ["u1"]
    );
  });

  it("executeScript splits by semicolon and runs each statement", async () => {
    vi.mocked(mockClient.execute).mockResolvedValue(null);
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    await adapter.executeScript(
      "CREATE TABLE t1 (a INT); CREATE TABLE t2 (b INT);"
    );

    expect(mockClient.execute).toHaveBeenCalledTimes(2);
    expect(mockClient.execute).toHaveBeenNthCalledWith(
      1,
      "CREATE TABLE t1 (a INT)"
    );
    expect(mockClient.execute).toHaveBeenNthCalledWith(
      2,
      "CREATE TABLE t2 (b INT)"
    );
  });

  it("getConnectionInfo returns supportsRelationJoins true", async () => {
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    const info = adapter.getConnectionInfo?.();
    expect(info).toEqual({ supportsRelationJoins: true });
  });

  it("startTransaction runs START TRANSACTION and returns transaction", async () => {
    vi.mocked(mockClient.execute).mockResolvedValue(null);
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    const tx = await adapter.startTransaction();

    expect(mockClient.execute).toHaveBeenCalledWith("START TRANSACTION");
    expect(tx.provider).toBe("mysql");
    expect(tx.commit).toBeDefined();
    expect(tx.rollback).toBeDefined();
    expect(tx.queryRaw).toBeDefined();
    expect(tx.executeRaw).toBeDefined();

    await tx.commit();
    expect(mockClient.execute).toHaveBeenCalledWith("COMMIT");

    await tx.rollback();
    expect(mockClient.execute).toHaveBeenCalledWith("ROLLBACK");
  });

  it("dispose does not throw", async () => {
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    await expect(adapter.dispose()).resolves.toBeUndefined();
  });

  it("queryRaw wraps execute errors as DriverAdapterError", async () => {
    vi.mocked(mockClient.execute).mockRejectedValue(new Error("DB error"));
    const factory = new PrismaSeekdb(mockClient);
    const adapter = await factory.connect();

    await expect(
      adapter.queryRaw({ sql: "SELECT 1", args: [], argTypes: [] })
    ).rejects.toMatchObject({
      name: "DriverAdapterError",
      cause: expect.objectContaining({ message: "DB error" }),
    });
  });
});
