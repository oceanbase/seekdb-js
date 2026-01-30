/**
 * seekdb Client - Embedded mode (local native addon)
 * Note: Requires native addon (similar to pylibseekdb in Python)
 */

import { InternalEmbeddedClient } from "./internal-client-embedded.js";
import { BaseSeekdbClient } from "./client-base.js";
import { DEFAULT_DATABASE } from "./utils.js";
import type { SeekdbClientArgs } from "./types.js";
import * as path from "node:path";

/**
 * seekdb Client for embedded mode (local native addon)
 */
export class SeekdbEmbeddedClient extends BaseSeekdbClient {
    protected readonly _internal: InternalEmbeddedClient;
    protected readonly _path: string;
    protected readonly _database: string;

    constructor(args: SeekdbClientArgs) {
        super();
        if (!args.path) {
            throw new Error(
                "SeekdbEmbeddedClient requires path parameter for embedded mode."
            );
        }
        this._path = path.resolve(args.path);
        this._database = args.database ?? DEFAULT_DATABASE;
        this._internal = new InternalEmbeddedClient({
            path: this._path,
            database: this._database,
        });
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
