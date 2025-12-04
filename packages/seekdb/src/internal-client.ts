import { Connection } from "./connection.js";
import type { RowDataPacket } from "mysql2/promise";
import type { SeekDBClientArgs } from "./types.js";
import {
  DEFAULT_TENANT,
  DEFAULT_DATABASE,
  DEFAULT_PORT,
  DEFAULT_USER,
  DEFAULT_CHARSET,
} from "./utils.js";

export class InternalClient {
  private readonly connectionManager: Connection;
  public readonly tenant: string;
  public readonly database: string;

  constructor(args: SeekDBClientArgs) {
    const host = args.host;
    const port = args.port ?? DEFAULT_PORT;
    this.tenant = args.tenant ?? DEFAULT_TENANT;
    this.database = args.database ?? DEFAULT_DATABASE;
    const user = args.user ?? DEFAULT_USER;
    const password = args.password ?? process.env.SEEKDB_PASSWORD ?? "";
    const charset = args.charset ?? DEFAULT_CHARSET;

    const fullUser = this.tenant ? `${user}@${this.tenant}` : user;

    this.connectionManager = new Connection({
      host,
      port,
      user: fullUser,
      password,
      database: this.database,
      charset,
    });
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  async execute(
    sql: string,
    params?: unknown[],
  ): Promise<RowDataPacket[] | null> {
    return this.connectionManager.execute(sql, params);
  }

  async close(): Promise<void> {
    await this.connectionManager.close();
  }
}
