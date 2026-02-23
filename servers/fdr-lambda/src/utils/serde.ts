import { Worker } from "node:worker_threads";

/**
 * Threshold in bytes above which JSON.parse is offloaded to a worker thread
 * to avoid blocking the Node.js event loop.
 */
const WORKER_PARSE_THRESHOLD_BYTES = 1_000_000; // 1MB

export function readBuffer(val: Buffer): unknown {
    const raw = val.toString();
    return JSON.parse(raw);
}

/**
 * Async version of readBuffer that offloads JSON.parse to a worker thread
 * for payloads above 1MB. This prevents large API definitions and docs
 * definitions from blocking the event loop.
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
                reject(new SyntaxError(msg.error));
            } else {
                resolve(msg.result);
            }
            void worker.terminate();
        });

        worker.on("error", (err) => {
            reject(err);
        });
    });
}
