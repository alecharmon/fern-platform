import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    checkCreditAllowance,
    getCreditUsage,
    insertCreditUsage,
    logActivityWithCredits,
    sumCreditUsage
} from "../credit-usage.js";
import type { AskFernEvent, FernWriterEvent } from "../types.js";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockSingle = vi.fn();
const _mockMaybeSingle = vi.fn();

const mockFrom = vi.fn();

vi.mock("@fern-platform/supabase", () => ({
    getClient: () => ({
        from: mockFrom
    })
}));

const fakeCreditUsage = {
    id: "credit-123",
    org_id: "org-1",
    site: "docs.example.com",
    type: "ask_fern",
    credits_used: 100,
    event_id: "event-123",
    created_at: "2026-03-09T00:00:00Z"
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

describe("insertCreditUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ insert: mockInsert });
        mockInsert.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ single: mockSingle });
    });

    it("inserts a credit usage record", async () => {
        mockSingle.mockResolvedValue({ data: fakeCreditUsage, error: null });

        const result = await insertCreditUsage("org-1", "docs.example.com", "ask_fern", 100, "event-123");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.credits_used).toBe(100);
            expect(result.value.type).toBe("ask_fern");
        }
        expect(mockFrom).toHaveBeenCalledWith("org_fern_credit_usage");
    });

    it("returns INSERT_FAILED on error", async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: "db error" } });

        const result = await insertCreditUsage("org-1", "docs.example.com", "ask_fern", 100, "event-123");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INSERT_FAILED");
        }
    });
});

describe("getCreditUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ order: mockOrder, eq: mockEq });
        mockOrder.mockReturnValue({ range: mockRange });
        mockRange.mockResolvedValue({ data: [fakeCreditUsage], error: null });
    });

    it("returns credit usage records for an org", async () => {
        const result = await getCreditUsage("org-1");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(1);
            expect(result.value[0]!.credits_used).toBe(100);
        }
    });
});

describe("sumCreditUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ gte: mockGte, eq: mockEq });
        mockGte.mockReturnValue({ lte: mockLte });
        mockLte.mockResolvedValue({ data: [{ credits_used: 50 }, { credits_used: 75 }], error: null });
    });

    it("sums credit usage over a time range", async () => {
        const result = await sumCreditUsage("org-1", "2026-03-01T00:00:00Z", "2026-03-31T23:59:59Z");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBe(125);
        }
    });

    it("returns 0 when no records found", async () => {
        mockLte.mockResolvedValue({ data: [], error: null });
        const result = await sumCreditUsage("org-1", "2026-03-01T00:00:00Z", "2026-03-31T23:59:59Z");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBe(0);
        }
    });
});

describe("logActivityWithCredits", () => {
    const askFernEvent: AskFernEvent = {
        type: "ask_fern",
        metadata: { question: "How?", response_tokens: 100 }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock for both activity log and credit usage inserts
        const mockInsertChain = { select: vi.fn().mockReturnValue({ single: vi.fn() }) };

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: fakeActivityLog, error: null })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: fakeCreditUsage, error: null })
                        })
                    })
                };
            }
            return mockInsertChain;
        });
    });

    it("inserts both activity log and credit usage", async () => {
        const result = await logActivityWithCredits("org-1", "docs.example.com", askFernEvent);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.event.id).toBe("event-123");
            expect(result.value.credit.credits_used).toBe(100);
        }
    });

    it("calculates credits from response_tokens", async () => {
        const result = await logActivityWithCredits("org-1", "docs.example.com", askFernEvent);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.credit.credits_used).toBe(100);
        }
    });
});

describe("logActivityWithCredits upsert", () => {
    const fernWriterEventWithSession: FernWriterEvent = {
        type: "fern_writer",
        metadata: {
            github_repo: "org/repo",
            response_tokens: 200,
            devin_session_id: "devin-session-abc"
        }
    };

    const fernWriterEventWithoutSession: FernWriterEvent = {
        type: "fern_writer",
        metadata: {
            github_repo: "org/repo",
            response_tokens: 150
        }
    };

    const existingActivityRow = {
        id: "existing-event-456",
        org_id: "org-1",
        site: "docs.example.com",
        type: "fern_writer",
        metadata: {
            github_repo: "org/repo",
            response_tokens: 100,
            devin_session_id: "devin-session-abc"
        },
        expires_at: null,
        created_at: "2026-03-09T00:00:00Z"
    };

    const existingCreditRow = {
        id: "credit-456",
        org_id: "org-1",
        site: "docs.example.com",
        type: "fern_writer",
        credits_used: 100,
        event_id: "existing-event-456",
        created_at: "2026-03-09T00:00:00Z"
    };

    it("updates existing event when devin_session_id matches", async () => {
        const mockUpdate = vi.fn();
        const mockUpdateEq = vi.fn();
        const mockCreditUpdate = vi.fn();
        const mockCreditUpdateEq = vi.fn();

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    gte: vi.fn().mockReturnValue({
                                        maybeSingle: vi.fn().mockResolvedValue({
                                            data: existingActivityRow,
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    }),
                    update: mockUpdate.mockReturnValue({
                        eq: mockUpdateEq.mockResolvedValue({ error: null })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: existingCreditRow,
                                error: null
                            })
                        })
                    }),
                    update: mockCreditUpdate.mockReturnValue({
                        eq: mockCreditUpdateEq.mockResolvedValue({ error: null })
                    })
                };
            }
            return {};
        });

        const result = await logActivityWithCredits("org-1", "docs.example.com", fernWriterEventWithSession);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.event.id).toBe("existing-event-456");
            expect(result.value.credit.credits_used).toBe(200);
        }
        expect(mockUpdate).toHaveBeenCalledWith({
            metadata: fernWriterEventWithSession.metadata
        });
        expect(mockCreditUpdate).toHaveBeenCalledWith({ credits_used: 200 });
    });

    it("inserts new records when no existing devin_session_id found", async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    gte: vi.fn().mockReturnValue({
                                        maybeSingle: vi.fn().mockResolvedValue({
                                            data: null,
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    }),
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: fakeActivityLog,
                                error: null
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: fakeCreditUsage,
                                error: null
                            })
                        })
                    })
                };
            }
            return {};
        });

        const result = await logActivityWithCredits("org-1", "docs.example.com", fernWriterEventWithSession);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.event.id).toBe("event-123");
            expect(result.value.credit.credits_used).toBe(100);
        }
    });

    it("falls through to insert for fern_writer without devin_session_id", async () => {
        const insertMock = vi.fn();

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                return {
                    insert: insertMock.mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: fakeActivityLog,
                                error: null
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: fakeCreditUsage,
                                error: null
                            })
                        })
                    })
                };
            }
            return {};
        });

        const result = await logActivityWithCredits("org-1", "docs.example.com", fernWriterEventWithoutSession);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.event.id).toBe("event-123");
        }
        expect(insertMock).toHaveBeenCalled();
    });
});

describe("logActivityWithCredits ask_fern conversation dedup", () => {
    const askFernWithConversation: AskFernEvent = {
        type: "ask_fern",
        metadata: {
            question: "What is Fern?",
            response_tokens: 500,
            conversation_id: "conv-abc-123"
        }
    };

    const askFernWithoutConversation: AskFernEvent = {
        type: "ask_fern",
        metadata: {
            question: "What is Fern?",
            response_tokens: 500
        }
    };

    const newActivityRow = {
        id: "new-event-001",
        org_id: "org-1",
        site: "docs.example.com",
        type: "ask_fern",
        metadata: {
            question: "What is Fern?",
            response_tokens: 500,
            conversation_id: "conv-abc-123"
        },
        expires_at: null,
        created_at: "2026-03-09T00:00:00Z"
    };

    const existingAskFernCreditRow = {
        id: "credit-789",
        org_id: "org-1",
        site: "docs.example.com",
        type: "ask_fern",
        credits_used: 2,
        event_id: "prior-event-789",
        created_at: "2026-03-09T00:00:00Z"
    };

    it("first turn of conversation: inserts both activity log and credit row", async () => {
        const insertActivityMock = vi.fn();
        const insertCreditMock = vi.fn();
        let activityCallCount = 0;

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                activityCallCount++;
                if (activityCallCount === 1) {
                    // First call: insertActivityLog (INSERT)
                    return {
                        insert: insertActivityMock.mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: newActivityRow,
                                    error: null
                                })
                            })
                        })
                    };
                }
                // Second call: lookup prior events with same conversation_id (no .limit())
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    neq: vi.fn().mockReturnValue({
                                        gte: vi.fn().mockResolvedValue({
                                            data: [],
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: insertCreditMock.mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { ...existingAskFernCreditRow, id: "new-credit-001", event_id: "new-event-001" },
                                error: null
                            })
                        })
                    })
                };
            }
            return {};
        });

        const result = await logActivityWithCredits("org-1", "docs.example.com", askFernWithConversation);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.event.id).toBe("new-event-001");
            expect(result.value.credit.credits_used).toBe(2);
        }
        expect(insertActivityMock).toHaveBeenCalled();
        expect(insertCreditMock).toHaveBeenCalled();
    });

    it("second turn with same conversation_id: inserts new activity log, skips credit insertion", async () => {
        const insertActivityMock = vi.fn();
        let activityCallCount = 0;
        let creditCallCount = 0;

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                activityCallCount++;
                if (activityCallCount === 1) {
                    // First call: insertActivityLog (always INSERT new row)
                    return {
                        insert: insertActivityMock.mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { ...newActivityRow, id: "new-event-002" },
                                    error: null
                                })
                            })
                        })
                    };
                }
                // Second call: lookup ALL prior events with same conversation_id (no .limit())
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    neq: vi.fn().mockReturnValue({
                                        gte: vi.fn().mockResolvedValue({
                                            data: [{ id: "prior-event-789" }],
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                creditCallCount++;
                // Lookup existing credit row linked to ANY prior event via .in()
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: existingAskFernCreditRow,
                                    error: null
                                })
                            })
                        })
                    })
                };
            }
            return {};
        });

        const result = await logActivityWithCredits("org-1", "docs.example.com", askFernWithConversation);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            // New activity log row (not the prior one)
            expect(result.value.event.id).toBe("new-event-002");
            // Returns existing credit row (no new credit inserted)
            expect(result.value.credit.id).toBe("credit-789");
            expect(result.value.credit.credits_used).toBe(2);
        }
        // Activity log was inserted (not updated)
        expect(insertActivityMock).toHaveBeenCalled();
        // Credit usage table was only queried (select), never inserted
        expect(creditCallCount).toBe(1); // only the select call, no insert
    });

    it("missing conversation_id: falls through to normal per-turn insert", async () => {
        const insertMock = vi.fn();

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                return {
                    insert: insertMock.mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: fakeActivityLog,
                                error: null
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: fakeCreditUsage,
                                error: null
                            })
                        })
                    })
                };
            }
            return {};
        });

        const result = await logActivityWithCredits("org-1", "docs.example.com", askFernWithoutConversation);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.event.id).toBe("event-123");
        }
        expect(insertMock).toHaveBeenCalled();
    });

    it("different conversation_ids: separate activity logs and separate credit rows", async () => {
        const askFernConvA: AskFernEvent = {
            type: "ask_fern",
            metadata: { question: "Q1", response_tokens: 100, conversation_id: "conv-A" }
        };
        const askFernConvB: AskFernEvent = {
            type: "ask_fern",
            metadata: { question: "Q2", response_tokens: 200, conversation_id: "conv-B" }
        };

        // --- Conversation A (first turn) ---
        const insertActivityMockA = vi.fn();
        const insertCreditMockA = vi.fn();
        let activityCallCountA = 0;

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                activityCallCountA++;
                if (activityCallCountA === 1) {
                    return {
                        insert: insertActivityMockA.mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { ...fakeActivityLog, id: "event-conv-a" },
                                    error: null
                                })
                            })
                        })
                    };
                }
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    neq: vi.fn().mockReturnValue({
                                        gte: vi.fn().mockResolvedValue({
                                            data: [],
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: insertCreditMockA.mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: {
                                    ...fakeCreditUsage,
                                    id: "credit-conv-a",
                                    event_id: "event-conv-a",
                                    credits_used: 2
                                },
                                error: null
                            })
                        })
                    })
                };
            }
            return {};
        });

        const resultA = await logActivityWithCredits("org-1", "docs.example.com", askFernConvA);
        expect(resultA.isOk()).toBe(true);
        if (resultA.isOk()) {
            expect(resultA.value.event.id).toBe("event-conv-a");
            expect(resultA.value.credit.credits_used).toBe(2);
        }

        // --- Conversation B (first turn, different conversation_id) ---
        const insertActivityMockB = vi.fn();
        const insertCreditMockB = vi.fn();
        let activityCallCountB = 0;

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                activityCallCountB++;
                if (activityCallCountB === 1) {
                    return {
                        insert: insertActivityMockB.mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { ...fakeActivityLog, id: "event-conv-b" },
                                    error: null
                                })
                            })
                        })
                    };
                }
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    neq: vi.fn().mockReturnValue({
                                        gte: vi.fn().mockResolvedValue({
                                            data: [],
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: insertCreditMockB.mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: {
                                    ...fakeCreditUsage,
                                    id: "credit-conv-b",
                                    event_id: "event-conv-b",
                                    credits_used: 2
                                },
                                error: null
                            })
                        })
                    })
                };
            }
            return {};
        });

        const resultB = await logActivityWithCredits("org-1", "docs.example.com", askFernConvB);
        expect(resultB.isOk()).toBe(true);
        if (resultB.isOk()) {
            expect(resultB.value.event.id).toBe("event-conv-b");
            expect(resultB.value.credit.credits_used).toBe(2);
        }

        expect(insertActivityMockA).toHaveBeenCalled();
        expect(insertCreditMockA).toHaveBeenCalled();
        expect(insertActivityMockB).toHaveBeenCalled();
        expect(insertCreditMockB).toHaveBeenCalled();
    });
});

describe("checkCreditAllowance", () => {
    it("returns allowed=true with usage and limit when entitled", async () => {
        const mockCheck = vi.fn().mockResolvedValue({
            entitled: true,
            type: "metered",
            allowance: 1000,
            used: 250,
            remaining: 750,
            overagePolicy: "hard_cap"
        });

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ allowed: true, used: 250, limit: 1000 });
        }
        expect(mockCheck).toHaveBeenCalledWith("org-1", "ai_credits");
    });

    it("returns allowed=false when not entitled", async () => {
        const mockCheck = vi.fn().mockResolvedValue({
            entitled: false,
            reason: "ai_credits allowance exhausted (1000/1000)",
            limit: 1000,
            used: 1000
        });

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ allowed: false, used: 1000, limit: 1000 });
        }
    });

    it("returns allowed=false with zero limit when no grant exists", async () => {
        const mockCheck = vi.fn().mockResolvedValue({
            entitled: false,
            reason: "No active entitlement for ai_credits"
        });

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ allowed: false, used: 0, limit: 0 });
        }
    });

    it("returns error when check throws", async () => {
        const mockCheck = vi.fn().mockRejectedValue(new Error("entitlements down"));

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("QUERY_FAILED");
        }
    });
});
