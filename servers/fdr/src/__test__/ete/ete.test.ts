import { describe, it } from "vitest";

const PORT = 8080;

describe("FDR container tests", () => {
    it("check health", async () => {
        const response = await fetch(`http://0.0.0.0:${PORT}/health`);
        if (!response.ok) {
            throw new Error(`Health check failed with status ${response.status}`);
        }
    });

    it("test ETE connection to DB", async () => {
        const response = await fetch(`http://localhost:${PORT}/registry/api/latest/load/1`);
        const responseText = await response.text();
        console.log(`Response body: '${responseText}'`);

        if (response.status !== 404) {
            throw new Error(`Expected 404 status but got ${response.status}: '${responseText}'`);
        }
    });
});
