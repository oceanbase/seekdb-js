/**
 * Embedded mode: validates client.execute in various scenarios:
 * - SELECT (no params / with params)
 * - DDL (CREATE TABLE, DROP TABLE)
 * - DML (INSERT, UPDATE, DELETE) with params
 * - SET user variable and session state
 * - Hybrid search on SQL-created table (no collection API)
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";
import { SQLBuilder } from "../../../src/sql-builder.js";

const TEST_CONFIG = getEmbeddedTestConfig("client-execute.test.ts");

const TABLE_HYBRID = "doc_table_search_sql";

describe("Embedded Mode - client.execute", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("client-execute.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  test("execute SELECT without params returns rows", async () => {
    const one = await client.execute("SELECT 1 AS one");
    expect(one).toBeDefined();
    expect(Array.isArray(one)).toBe(true);
    expect((one as Record<string, unknown>[])[0]?.one).toBe(1);

    const db = await client.execute("SELECT DATABASE() AS db");
    expect(db).toBeDefined();
    expect(Array.isArray(db)).toBe(true);
    expect((db as Record<string, unknown>[])[0]?.db).toBeDefined();
  });

  test("execute SELECT with params returns rows", async () => {
    const rows = await client.execute("SELECT ? AS a, ? AS b", [42, "hello"]);
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as Record<string, unknown>[]).length).toBe(1);
    expect((rows as Record<string, unknown>[])[0]?.a).toBe(42);
    expect((rows as Record<string, unknown>[])[0]?.b).toBe("hello");
  });

  test("execute DDL (CREATE TABLE, DROP TABLE)", async () => {
    const t = "exec_t_ddl";
    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);

    await client.execute(`
      CREATE TABLE \`${t}\` (
        id INT PRIMARY KEY,
        name STRING
      ) ORGANIZATION = HEAP
    `);

    const rows = await client.execute(`SELECT 1 FROM \`${t}\` LIMIT 1`);
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);

    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
  });

  test("execute INSERT with params and SELECT returns inserted data", async () => {
    const t = "exec_t_insert";
    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
    await client.execute(`
      CREATE TABLE \`${t}\` (id INT PRIMARY KEY, name STRING) ORGANIZATION = HEAP
    `);

    await client.execute(`INSERT INTO \`${t}\` (id, name) VALUES (?, ?)`, [
      1,
      "alice",
    ]);
    await client.execute(`INSERT INTO \`${t}\` (id, name) VALUES (?, ?)`, [
      2,
      "bob",
    ]);

    const rows = await client.execute(
      `SELECT id, name FROM \`${t}\` ORDER BY id`
    );
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as Record<string, unknown>[]).length).toBe(2);
    expect((rows as Record<string, unknown>[])[0]?.id).toBe(1);
    expect((rows as Record<string, unknown>[])[0]?.name).toBe("alice");
    expect((rows as Record<string, unknown>[])[1]?.id).toBe(2);
    expect((rows as Record<string, unknown>[])[1]?.name).toBe("bob");

    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
  });

  test("execute UPDATE and SELECT returns updated data", async () => {
    const t = "exec_t_update";
    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
    await client.execute(`
      CREATE TABLE \`${t}\` (id INT PRIMARY KEY, name STRING) ORGANIZATION = HEAP
    `);
    await client.execute(`INSERT INTO \`${t}\` (id, name) VALUES (?, ?)`, [
      1,
      "old",
    ]);

    await client.execute(`UPDATE \`${t}\` SET name = ? WHERE id = ?`, [
      "new",
      1,
    ]);

    const rows = await client.execute(`SELECT name FROM \`${t}\` WHERE id = 1`);
    expect(rows).toBeDefined();
    expect((rows as Record<string, unknown>[]).length).toBe(1);
    expect((rows as Record<string, unknown>[])[0]?.name).toBe("new");

    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
  });

  test("execute DELETE and SELECT returns reduced rows", async () => {
    const t = "exec_t_delete";
    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
    await client.execute(`
      CREATE TABLE \`${t}\` (id INT PRIMARY KEY, name STRING) ORGANIZATION = HEAP
    `);
    await client.execute(`INSERT INTO \`${t}\` (id, name) VALUES (?, ?)`, [
      1,
      "a",
    ]);
    await client.execute(`INSERT INTO \`${t}\` (id, name) VALUES (?, ?)`, [
      2,
      "b",
    ]);

    await client.execute(`DELETE FROM \`${t}\` WHERE id = ?`, [1]);

    const rows = await client.execute(`SELECT id FROM \`${t}\` ORDER BY id`);
    expect(rows).toBeDefined();
    expect((rows as Record<string, unknown>[]).length).toBe(1);
    expect((rows as Record<string, unknown>[])[0]?.id).toBe(2);

    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
  });

  test("execute SET user variable and SELECT uses session state", async () => {
    const { sql: setSql, params: setParams } = SQLBuilder.buildSetVariable(
      "exec_var",
      "123"
    );
    await client.execute(setSql, setParams);

    const rows = await client.execute("SELECT @exec_var AS v");
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
    const val = (rows as Record<string, unknown>[])[0]?.v;
    expect(val === 123 || val === "123").toBe(true);
  });

  test("execute SELECT from empty table returns empty array", async () => {
    const t = "exec_t_empty";
    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
    await client.execute(`
      CREATE TABLE \`${t}\` (id INT PRIMARY KEY) ORGANIZATION = HEAP
    `);

    const rows = await client.execute(`SELECT * FROM \`${t}\``);
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as unknown[]).length).toBe(0);

    await client.execute(`DROP TABLE IF EXISTS \`${t}\``);
  });

  test("hybrid search on table created by SQL (no collection API) returns rows", async () => {
    await client.execute(`DROP TABLE IF EXISTS \`${TABLE_HYBRID}\``);

    await client.execute(`
      CREATE TABLE \`${TABLE_HYBRID}\` (
        _id VARBINARY(512) PRIMARY KEY NOT NULL,
        document STRING,
        embedding VECTOR(3),
        metadata JSON,
        FULLTEXT INDEX idx_fts (document) WITH PARSER ik,
        VECTOR INDEX idx_vec (embedding) WITH(distance=l2, type=hnsw, lib=vsag)
      ) ORGANIZATION = HEAP
    `);

    const rowsData: Array<{
      id: string;
      document: string;
      embedding: string;
      metadata: string;
    }> = [
      {
        id: "1",
        document: "hello world",
        embedding: "[1,2,3]",
        metadata: "{}",
      },
      {
        id: "2",
        document: "hello world, what is your name",
        embedding: "[1,2,1]",
        metadata: "{}",
      },
      {
        id: "3",
        document: "hello world, how are you",
        embedding: "[1,1,1]",
        metadata: "{}",
      },
      {
        id: "4",
        document: "real world, where are you from",
        embedding: "[1,3,1]",
        metadata: "{}",
      },
      {
        id: "5",
        document: "real world, how old are you",
        embedding: "[1,3,2]",
        metadata: "{}",
      },
      {
        id: "6",
        document: "hello world, where are you from",
        embedding: "[2,1,1]",
        metadata: "{}",
      },
    ];
    for (const row of rowsData) {
      await client.execute(
        `INSERT INTO \`${TABLE_HYBRID}\` (_id, document, metadata, embedding) VALUES (?, ?, ?, ?)`,
        [row.id, row.document, row.metadata, row.embedding]
      );
    }

    await new Promise((r) => setTimeout(r, 800));

    const searchParm = {
      query: {
        query_string: { fields: ["document"], query: "hello world" },
      },
      knn: {
        field: "embedding",
        k: 5,
        query_vector: [1, 2, 3],
      },
      size: 5,
    };
    const { sql: setSql, params: setParams } = SQLBuilder.buildSetVariable(
      "search_parm",
      JSON.stringify(searchParm)
    );
    await client.execute(setSql, setParams);

    const searchSql = `SELECT DBMS_HYBRID_SEARCH.SEARCH('${TABLE_HYBRID.replace(/'/g, "''")}', @search_parm) as result`;
    const rows = await client.execute(searchSql);

    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows!.length).toBeGreaterThan(0);

    await client.execute(`DROP TABLE IF EXISTS \`${TABLE_HYBRID}\``);
  });
});
