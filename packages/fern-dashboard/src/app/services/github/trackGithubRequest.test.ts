import type { Octokit } from "@octokit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withRequestTracking } from "./trackGithubRequest";

// ---------------------------------------------------------------------------
// Mock Redis
// ---------------------------------------------------------------------------

const mockIncr = vi.fn().mockResolvedValue(1);
const mockExpire = vi.fn().mockResolvedValue(1);

vi.mock("@/app/services/redis/redis", () => ({
    getRedisClient: () => ({
        incr: mockIncr,
        expire: mockExpire
    })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockOctokit(): Octokit & { __simulateRequest: (options: Record<string, unknown>) => void } {
    const hooks: Array<(response: unknown, options: Record<string, unknown>) => void> = [];
    return {
        hook: {
            after: (_event: string, fn: (response: unknown, options: Record<string, unknown>) => void) => {
                hooks.push(fn);
            }
        },
        __simulateRequest: (options: Record<string, unknown>) => {
            for (const fn of hooks) {
                fn({}, options);
            }
        }
    } as unknown as Octokit & { __simulateRequest: (options: Record<string, unknown>) => void };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("withRequestTracking", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-26T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("returns the same octokit instance", () => {
        const octokit = createMockOctokit();
        const tracked = withRequestTracking(octokit);
        expect(tracked).toBe(octokit);
    });

    it("increments a daily Redis counter when owner and repo are present", async () => {
        const octokit = createMockOctokit();
        withRequestTracking(octokit);

        octokit.__simulateRequest({ url: "/repos/{owner}/{repo}/pulls", owner: "fern-api", repo: "fern-platform" });
        await vi.advanceTimersByTimeAsync(0);

        expect(mockIncr).toHaveBeenCalledWith("github-usage:fern-api:fern-platform:2026-03-26");
        expect(mockExpire).toHaveBeenCalledWith("github-usage:fern-api:fern-platform:2026-03-26", 86_400 * 2);
    });

    it("does not track requests without owner/repo params", async () => {
        const octokit = createMockOctokit();
        withRequestTracking(octokit);

        octokit.__simulateRequest({ url: "/user" });
        await vi.advanceTimersByTimeAsync(0);

        expect(mockIncr).not.toHaveBeenCalled();
    });

    it("does not track when owner or repo is not a string", async () => {
        const octokit = createMockOctokit();
        withRequestTracking(octokit);

        octokit.__simulateRequest({ url: "/repos/{owner}/{repo}/pulls", owner: 123, repo: "docs" });
        await vi.advanceTimersByTimeAsync(0);

        expect(mockIncr).not.toHaveBeenCalled();
    });

    it("tracks different repos independently", async () => {
        const octokit = createMockOctokit();
        withRequestTracking(octokit);

        octokit.__simulateRequest({ url: "/repos/{owner}/{repo}/pulls", owner: "acme", repo: "docs" });
        octokit.__simulateRequest({ url: "/repos/{owner}/{repo}/git/refs", owner: "acme", repo: "api" });
        await vi.advanceTimersByTimeAsync(0);

        expect(mockIncr).toHaveBeenCalledWith("github-usage:acme:docs:2026-03-26");
        expect(mockIncr).toHaveBeenCalledWith("github-usage:acme:api:2026-03-26");
    });

    it("logs error but does not throw when Redis fails", async () => {
        mockIncr.mockRejectedValueOnce(new Error("Redis down"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const octokit = createMockOctokit();
        withRequestTracking(octokit);

        octokit.__simulateRequest({ url: "/repos/{owner}/{repo}/pulls", owner: "fern-api", repo: "fern-platform" });
        await vi.advanceTimersByTimeAsync(0);

        expect(consoleSpy).toHaveBeenCalledWith("[trackGithubRequest] Failed to record request:", expect.any(Error));
        consoleSpy.mockRestore();
    });
});
