import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUsageCache, type UsageCache } from "../usage/cache";

// Mock the supabase client
vi.mock("@fern-platform/supabase", () => ({
    getClient: vi.fn()
}));

import { getClient } from "@fern-platform/supabase";

describe("UsageCache", () => {
    let cache: UsageCache;
    let mockUpsert: ReturnType<typeof vi.fn>;

    function setupMockClient(selectResult: { data: unknown; error: unknown }) {
        const mockMaybeSingle = vi.fn().mockResolvedValue(selectResult);
        const mockEqKey = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqKey });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });
        mockUpsert = vi.fn().mockResolvedValue({ error: null });

        vi.mocked(getClient).mockReturnValue({
            from: vi.fn().mockReturnValue({
                select: mockSelect,
                upsert: mockUpsert
            })
        } as any);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        cache = createUsageCache();
    });

    it("get returns null when no cached row", async () => {
        setupMockClient({ data: null, error: null });
        cache = createUsageCache();
        const result = await cache.get("org-1", "seats", 60_000);
        expect(result).toBeNull();
    });

    it("get returns cached count when fresh", async () => {
        const now = new Date().toISOString();
        setupMockClient({ data: { usage_count: 5, updated_at: now }, error: null });
        cache = createUsageCache();
        const result = await cache.get("org-1", "seats", 60_000);
        expect(result).toBe(5);
    });

    it("get returns null when stale", async () => {
        const staleTime = new Date(Date.now() - 120_000).toISOString();
        setupMockClient({ data: { usage_count: 5, updated_at: staleTime }, error: null });
        cache = createUsageCache();
        const result = await cache.get("org-1", "seats", 60_000);
        expect(result).toBeNull();
    });

    it("set upserts usage count", async () => {
        setupMockClient({ data: null, error: null });
        cache = createUsageCache();
        await cache.set("org-1", "seats", 10);
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ org_id: "org-1", key: "seats", usage_count: 10 }),
            expect.anything()
        );
    });

    it("increment reads current and upserts new value", async () => {
        setupMockClient({ data: { usage_count: 5 }, error: null });
        cache = createUsageCache();
        const result = await cache.increment("org-1", "seats");
        expect(result).toBe(6);
    });

    it("decrement reads current and upserts new value, floors at 0", async () => {
        setupMockClient({ data: { usage_count: 0 }, error: null });
        cache = createUsageCache();
        const result = await cache.decrement("org-1", "seats");
        expect(result).toBe(0);
    });
});
