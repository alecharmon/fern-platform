import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActivityLog, getActivityLogs, insertActivityLog } from "../activity-log.js";
import type { AskFernEvent } from "../types.js";

// Mock @fern-platform/supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const _mockLimit = vi.fn();
const mockRange = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

const mockFrom = vi.fn();

vi.mock("@fern-platform/supabase", () => ({
    getClient: () => ({
        from: mockFrom
    })
}));

const askFernEvent: AskFernEvent = {
    type: "ask_fern",
    metadata: { question: "How?", response_tokens: 100 }
};

const fakeActivityLog = {
    id: "event-123",
    org_id: "org-1",
    site: "docs.example.com",
    type: "ask_fern",
    metadata: { question: "How?", response_tokens: 100 },
    expires_at: null,
    created_at: "2026-03-09T00:00:00Z"
};

describe("insertActivityLog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ insert: mockInsert });
        mockInsert.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ single: mockSingle });
    });

    it("inserts an activity log and returns it", async () => {
        mockSingle.mockResolvedValue({ data: fakeActivityLog, error: null });

        const result = await insertActivityLog("org-1", "docs.example.com", askFernEvent);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.id).toBe("event-123");
            expect(result.value.type).toBe("ask_fern");
        }
        expect(mockFrom).toHaveBeenCalledWith("org_activity_log");
    });

    it("computes expires_at from ttl", async () => {
        mockSingle.mockResolvedValue({ data: fakeActivityLog, error: null });

        await insertActivityLog("org-1", "docs.example.com", askFernEvent, { ttl: { days: 90 } });
        const insertArg = mockInsert.mock.calls[0]![0];
        expect(insertArg.expires_at).toBeDefined();
        // expires_at should be ~90 days from now
        const expiresAt = new Date(insertArg.expires_at);
        const ninetyDaysFromNow = Date.now() + 90 * 24 * 60 * 60 * 1000;
        expect(Math.abs(expiresAt.getTime() - ninetyDaysFromNow)).toBeLessThan(5000);
    });

    it("sets expires_at to null when no ttl", async () => {
        mockSingle.mockResolvedValue({ data: fakeActivityLog, error: null });

        await insertActivityLog("org-1", "docs.example.com", askFernEvent);
        const insertArg = mockInsert.mock.calls[0]![0];
        expect(insertArg.expires_at).toBeNull();
    });

    it("returns INSERT_FAILED on supabase error", async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: "db error" } });

        const result = await insertActivityLog("org-1", "docs.example.com", askFernEvent);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INSERT_FAILED");
        }
    });
});

describe("getActivityLogs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ order: mockOrder, eq: mockEq });
        mockOrder.mockReturnValue({ range: mockRange });
        mockRange.mockResolvedValue({ data: [fakeActivityLog], error: null });
    });

    it("returns activity logs for an org", async () => {
        const result = await getActivityLogs("org-1");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(1);
            expect(result.value[0]!.id).toBe("event-123");
        }
        expect(mockFrom).toHaveBeenCalledWith("org_activity_log");
    });
});

describe("getActivityLog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    });

    it("returns a single activity log by id", async () => {
        mockMaybeSingle.mockResolvedValue({ data: fakeActivityLog, error: null });

        const result = await getActivityLog("event-123");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value?.id).toBe("event-123");
        }
    });

    it("returns null when not found", async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });

        const result = await getActivityLog("nonexistent");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBeNull();
        }
    });
});
