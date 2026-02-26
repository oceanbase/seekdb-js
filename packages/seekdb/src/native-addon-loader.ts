/**
 * Lazy load native addon when embedded mode is first used.
 * Delegates to @seekdb/js-bindings (sync load or getNativeBindingAsync for on-demand download).
 */
import type * as Bindings from "@seekdb/js-bindings";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type NativeBindings = typeof Bindings;

type BindingsModule =
  | NativeBindings
  | { getNativeBindingAsync: () => Promise<NativeBindings> };

let _cached: NativeBindings | null = null;
let _loadPromise: Promise<NativeBindings> | null = null;

function isBinding(m: BindingsModule): m is NativeBindings {
  return typeof (m as NativeBindings).open === "function";
}

export async function getNativeAddon(): Promise<NativeBindings> {
  if (_cached) return _cached;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const m = require("@seekdb/js-bindings") as BindingsModule;
    if (isBinding(m)) {
      _cached = m;
      return m;
    }
    if (typeof m.getNativeBindingAsync === "function") {
      _cached = await m.getNativeBindingAsync();
      return _cached;
    }
    throw new Error(
      "SeekDB native bindings could not be loaded. Ensure @seekdb/js-bindings is installed and your platform is supported, or set SEEKDB_BINDINGS_BASE_URL for on-demand download."
    );
  })();

  return _loadPromise;
}

export function getNativeAddonSync(): NativeBindings | null {
  return _cached;
}
