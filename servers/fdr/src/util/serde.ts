import { Worker } from "node:worker_threads";

import { LOGGER } from "../app/FdrApplication";

/**
 * Threshold in bytes above which JSON.parse is offloaded to a worker thread
 * to avoid blocking the Node.js event loop. 1MB is chosen as the threshold
 * because JSON.parse on strings below this size completes in <10ms and the
 * worker thread overhead would be counterproductive.
 */
const WORKER_PARSE_THRESHOLD_BYTES = 1_000_000; // 1MB

export function writeBuffer(val: unknown): Buffer {
    return Buffer.from(JSON.stringify(val), "utf-8");
}

export function readBuffer(val: Buffer): unknown {
    const raw = val.toString();
    try {
        return JSON.parse(raw);
    } catch (e) {
        LOGGER.error(`Failed to parse buffer: ${raw}`);
        throw e;
    }
}

/**
 * Async version of readBuffer that offloads JSON.parse to a worker thread
 * for payloads above WORKER_PARSE_THRESHOLD_BYTES (1MB). This prevents
 * large API definitions and docs definitions from blocking the event loop.
 *
 * For smaller payloads, falls back to synchronous JSON.parse since the
 * worker thread overhead would exceed the parsing time.
 */
export async function readBufferAsync(val: Buffer): Promise<unknown> {
    if (val.byteLength < WORKER_PARSE_THRESHOLD_BYTES) {
        return readBuffer(val);
    }

    const raw = val.toString();

    return new Promise((resolve, reject) => {
        const worker = new Worker(
            `
            import { parentPort, workerData } from "node:worker_threads";
            try {
                const result = JSON.parse(workerData);
                parentPort?.postMessage({ result });
            } catch (e) {
                parentPort?.postMessage({ error: e instanceof Error ? e.message : String(e) });
            }
            `,
            {
                eval: true,
                workerData: raw
            }
        );

        worker.on("message", (msg: { result?: unknown; error?: string }) => {
            if (msg.error != null) {
                LOGGER.error(`Failed to parse buffer in worker: ${msg.error}`);
                reject(new SyntaxError(msg.error));
            } else {
                resolve(msg.result);
            }
            void worker.terminate();
        });

        worker.on("error", (err) => {
            LOGGER.error(`Worker thread error: ${err.message}`);
            reject(err);
        });
    });
}
