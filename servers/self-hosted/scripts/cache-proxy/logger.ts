/**
 * Logging utilities for the cache proxy.
 */

import { DEBUG } from "./config";

export function log(...args: unknown[]): void {
    // biome-ignore lint/suspicious/noConsole: This is a server script that needs to log
    console.log(`[${new Date().toISOString()}] [cache-proxy]`, ...args);
}

export function debug(...args: unknown[]): void {
    if (DEBUG) {
        log("[DEBUG]", ...args);
    }
}
