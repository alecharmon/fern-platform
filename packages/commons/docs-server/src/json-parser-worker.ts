// Worker thread for JSON parsing
// Save as: packages/commons/docs-server/src/json-parser-worker.ts

import { parentPort } from "worker_threads";

parentPort?.on("message", (jsonString: string) => {
    try {
        const parsed = JSON.parse(jsonString);
        parentPort?.postMessage({ success: true, data: parsed });
    } catch (error) {
        parentPort?.postMessage({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});
