import path from "path";
import { Worker } from "worker_threads";

// Helper to parse JSON in a worker thread
export async function parseJSONInWorker<T = any>(jsonString: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, "json-parser-worker.js"));

        const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error("JSON parsing timeout after 30 seconds"));
        }, 30000);

        worker.on("message", (result: { success: boolean; data?: T; error?: string }) => {
            clearTimeout(timeout);
            worker.terminate();

            if (result.success && result.data) {
                resolve(result.data);
            } else {
                reject(new Error(result.error || "Unknown parsing error"));
            }
        });

        worker.on("error", (error) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(error);
        });

        worker.postMessage(jsonString);
    });
}
