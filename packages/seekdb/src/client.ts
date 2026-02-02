/**
 * seekdb Client - Unified entry point for both embedded and remote server modes
 * Automatically selects the appropriate implementation based on parameters:
 * - If path is provided, uses embedded mode (SeekdbEmbeddedClient)
 * - If host is provided, uses remote server mode (SeekdbServerClient)
 */

import { SeekdbServerClient } from "./client-server.js";
import { SeekdbEmbeddedClient } from "./client-embedded.js";
import type {
  SeekdbClientArgs,
  CreateCollectionOptions,
  GetCollectionOptions,
} from "./types.js";
import type { Collection } from "./collection.js";
import type { Database } from "./database.js";

/**
 * seekdb Client - Unified client for both embedded and remote server modes
 * 
 * This class acts as a facade that delegates to either SeekdbEmbeddedClient
 * or SeekdbServerClient based on the provided parameters.
 */
export class SeekdbClient {
  private _delegate: SeekdbServerClient | SeekdbEmbeddedClient;

  constructor(args: SeekdbClientArgs) {
    const { path: dbPath, host } = args;

    if (dbPath !== undefined) {
      this._delegate = new SeekdbEmbeddedClient(args);
    } else if (host !== undefined) {
      this._delegate = new SeekdbServerClient(args);
    } else {
      throw new Error(
        "SeekdbClient requires either 'path' parameter for embedded mode or 'host' parameter for remote server mode."
      );
    }
    (this._delegate as { setFacade?(f: unknown): void }).setFacade?.(this);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._delegate.isConnected();
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this._delegate.close();
  }

  // ==================== Collection Management ====================

  /**
   * Create a new collection
   */
  async createCollection(
    options: CreateCollectionOptions
  ): Promise<Collection> {
    return this._delegate.createCollection(options);
  }

  /**
   * Get an existing collection
   */
  async getCollection(options: GetCollectionOptions): Promise<Collection> {
    return this._delegate.getCollection(options);
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<Collection[]> {
    return this._delegate.listCollections();
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    return this._delegate.deleteCollection(name);
  }

  /**
   * Check if collection exists
   */
  async hasCollection(name: string): Promise<boolean> {
    return this._delegate.hasCollection(name);
  }

  /**
   * Get or create collection
   */
  async getOrCreateCollection(
    options: CreateCollectionOptions
  ): Promise<Collection> {
    return this._delegate.getOrCreateCollection(options);
  }

  /**
   * Count collections
   */
  async countCollection(): Promise<number> {
    return this._delegate.countCollection();
  }

  // ==================== Database Management (admin) ====================
  // Explicit createDatabase: no auto-create on connect. Aligns with server and pyseekdb.

  async createDatabase(
    name: string,
    tenant?: string,
  ): Promise<void> {
    return this._delegate.createDatabase(name, tenant);
  }

  async getDatabase(
    name: string,
    tenant?: string,
  ): Promise<Database> {
    return this._delegate.getDatabase(name, tenant);
  }

  async deleteDatabase(
    name: string,
    tenant?: string,
  ): Promise<void> {
    return this._delegate.deleteDatabase(name, tenant);
  }

  async listDatabases(
    limit?: number,
    offset?: number,
    tenant?: string,
  ): Promise<Database[]> {
    return this._delegate.listDatabases(limit, offset, tenant);
  }
}
