import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWorkflowStatus, retryPublishingWorkflow } from "../api";

describe("fetchWorkflowStatus", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should call workflow-status endpoint with correct params", async () => {
        const mockResponse = new Response(JSON.stringify({ status: "in_progress" }), { status: 200 });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

        const result = await fetchWorkflowStatus("fern-support", "my-repo", "abc123");

        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/workflow-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner: "fern-support",
                repoName: "my-repo",
                commitSha: "abc123"
            })
        });
        expect(result).toBe(mockResponse);
    });

    it("should omit commitSha when undefined", async () => {
        const mockResponse = new Response(JSON.stringify({ status: "not_found" }), { status: 200 });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

        await fetchWorkflowStatus("fern-support", "my-repo");

        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/workflow-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner: "fern-support",
                repoName: "my-repo",
                commitSha: undefined
            })
        });
    });
});

describe("retryPublishingWorkflow", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should call retry-workflow endpoint with correct params", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

        await retryPublishingWorkflow("fern-support", "my-repo", "my-org");

        expect(globalThis.fetch).toHaveBeenCalledWith("/api/onboarding-docs/retry-workflow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner: "fern-support",
                repoName: "my-repo",
                orgName: "my-org"
            })
        });
    });

    it("should throw an error when the response is not ok", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: "Workflow not found" }), { status: 404 })
        );

        await expect(retryPublishingWorkflow("fern-support", "my-repo", "my-org")).rejects.toThrow(
            "Workflow not found"
        );
    });

    it("should throw a default error message when no error field in response", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));

        await expect(retryPublishingWorkflow("fern-support", "my-repo", "my-org")).rejects.toThrow(
            "Failed to retry workflow"
        );
    });
});
