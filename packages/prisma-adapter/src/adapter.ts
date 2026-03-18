import type {
  ConnectionInfo,
  IsolationLevel,
  SqlDriverAdapter,
  SqlQuery,
  SqlResultSet,
  Transaction,
} from "@prisma/driver-adapter-utils";
import { Debug, DriverAdapterError } from "@prisma/driver-adapter-utils";
import { inferColumnTypes } from "./conversion.js";

const debug = Debug("prisma:driver-adapter:seekdb");
const ADAPTER_NAME = "@seekdb/prisma-adapter";

const EMPTY_RESULT: SqlResultSet = {
  columnNames: [],
  columnTypes: [],
  rows: [],
};

/** Minimal interface for seekdb client used by the adapter (execute only). */
export interface SeekdbClientLike {
  execute(
    sql: string,
    params?: unknown[]
  ): Promise<Record<string, unknown>[] | null>;
}

function rowsToResultSet(rows: Record<string, unknown>[]): SqlResultSet {
  const columnNames = Object.keys(rows[0]);
  const columnTypes = inferColumnTypes(columnNames, rows);
  const rowsArray = rows.map((r) => Object.values(r));
  return { columnNames, columnTypes, rows: rowsArray };
}

class SeekdbQueryable implements SqlDriverAdapter {
  readonly provider = "mysql" as const;
  readonly adapterName = ADAPTER_NAME;

  constructor(protected readonly client: SeekdbClientLike) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    debug("[queryRaw] %s", query.sql.substring(0, 80));
    const rows = await this.performQuery(query);
    if (!rows?.length) return EMPTY_RESULT;
    return rowsToResultSet(rows);
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    debug("[executeRaw] %s", query.sql.substring(0, 80));
    await this.performQuery(query);
    return 0;
  }

  protected async performQuery(
    query: SqlQuery
  ): Promise<Record<string, unknown>[] | null> {
    const { sql, args } = query;
    try {
      const params = args?.length ? args : undefined;
      return (await this.client.execute(sql, params)) as
        | Record<string, unknown>[]
        | null;
    } catch (e) {
      throw this.wrapError(e);
    }
  }

  protected wrapError(error: unknown): DriverAdapterError {
    if (error instanceof Error) {
      return new DriverAdapterError({
        kind: "mysql",
        code: 0,
        message: error.message,
        state: "SEEKDB",
      });
    }
    return new DriverAdapterError({
      kind: "GenericJs",
      id: 0,
    });
  }

  async executeScript(script: string): Promise<void> {
    const statements = script
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sql of statements) {
      await this.client.execute(sql);
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return { supportsRelationJoins: true };
  }

  async startTransaction(
    _isolationLevel?: IsolationLevel
  ): Promise<Transaction> {
    await this.client.execute("START TRANSACTION");
    const { client } = this;
    return {
      provider: this.provider,
      adapterName: this.adapterName,
      options: { usePhantomQuery: true },
      queryRaw: (q) => this.queryRaw(q),
      executeRaw: (q) => this.executeRaw(q),
      commit: () => client.execute("COMMIT"),
      rollback: () => client.execute("ROLLBACK"),
    };
  }

  async dispose(): Promise<void> {
    // Adapter does not own the client; do not close it.
  }
}

/**
 * Factory for Prisma driver adapter that uses seekdb Embedded client.execute().
 * Use with Prisma Client when datasource provider is "mysql" and you run seekdb in embedded mode.
 */
export class PrismaSeekdbAdapterFactory {
  readonly provider = "mysql" as const;
  readonly adapterName = ADAPTER_NAME;

  constructor(private readonly client: SeekdbClientLike) {}

  async connect(): Promise<SqlDriverAdapter> {
    return new SeekdbQueryable(this.client);
  }
}
