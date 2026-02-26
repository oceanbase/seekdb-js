/**
 * seekdb Client - Remote server mode (MySQL protocol)
 * Supports both seekdb Server and OceanBase Server
 */

import { InternalClient } from "./internal-client.js";
import { BaseSeekdbClient } from "./client-base.js";
import { DEFAULT_DATABASE } from "./utils.js";
import type { SeekdbClientArgs } from "./types.js";

/**
 * seekdb Client for remote server connections
 */
export class SeekdbServerClient extends BaseSeekdbClient {
  protected readonly _internal: InternalClient;
  protected readonly _database: string;

  constructor(args: SeekdbClientArgs) {
    super();
    if (!args.host) {
      throw new Error(
        "SeekdbServerClient requires host parameter for remote server mode."
      );
    }
    this._database = args.database ?? DEFAULT_DATABASE;
    this._internal = new InternalClient(args);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._internal.isConnected();
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this._internal.close();
  }
}
