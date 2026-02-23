/* eslint-disable turbo/no-undeclared-env-vars */
import { LoopsClient } from "loops";

/**
 * Singleton LoopsClient instance.
 *
 * Returns `undefined` when the LOOPS_API_KEY env var is not set,
 * allowing the wrapper to silently no-op in environments that
 * have not configured Loops.
 */
let _client: LoopsClient | undefined;
let _initialized = false;

export function getLoopsClient(): LoopsClient | undefined {
    if (!_initialized) {
        _initialized = true;
        const apiKey = process.env.LOOPS_API_KEY;
        if (apiKey) {
            _client = new LoopsClient(apiKey);
        } else {
            console.debug("[loops] LOOPS_API_KEY not set — Loops integration disabled");
        }
    }
    return _client;
}
