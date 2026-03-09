import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fern-platform/supabase", () => ({
    getClient: vi.fn()
}));

import { getClient } from "@fern-platform/supabase";
import { createBillingOverride, getActiveOverrides, getOverrideHistory, revokeBillingOverride } from "../db/overrides";

const mockGetClient = vi.mocked(getClient);

describe("billing overrides", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createBillingOverride", () => {
        it("inserts an override and returns it", async () => {
            const inserted = {
                id: "ovr_1",
                org_id: "org_123",
                sku: "2025-02-05:docs-team",
                added_by: "admin@fern.com",
                start_date: "2026-03-09T00:00:00Z",
                end_date: null,
                notes: "Trial extension",
                created_at: "2026-03-09T00:00:00Z",
                revoked_at: null
            };
            const mockClient = {
                from: vi.fn().mockReturnValue({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: inserted, error: null })
                        })
                    })
                })
            };
            mockGetClient.mockReturnValue(mockClient as any);

            const result = await createBillingOverride({
                org_id: "org_123",
                sku: "2025-02-05:docs-team",
                added_by: "admin@fern.com",
                notes: "Trial extension"
            });

            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap()).toEqual(inserted);
        });

        it("returns error when insert fails", async () => {
            const mockClient = {
                from: vi.fn().mockReturnValue({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: null, error: { message: "duplicate key" } })
                        })
                    })
                })
            };
            mockGetClient.mockReturnValue(mockClient as any);

            const result = await createBillingOverride({
                org_id: "org_123",
                sku: "2025-02-05:docs-team",
                added_by: "admin@fern.com"
            });

            expect(result.isErr()).toBe(true);
            expect(result._unsafeUnwrapErr().code).toBe("QUERY_FAILED");
        });
    });

    describe("getActiveOverrides", () => {
        it("returns active overrides for an org", async () => {
            const overrides = [
                {
                    id: "ovr_1",
                    org_id: "org_123",
                    sku: "2025-02-05:docs-team",
                    added_by: "admin@fern.com",
                    start_date: "2026-03-01T00:00:00Z",
                    end_date: null,
                    notes: null,
                    created_at: "2026-03-01T00:00:00Z",
                    revoked_at: null
                }
            ];
            const mockClient = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            is: vi.fn().mockReturnValue({
                                lte: vi.fn().mockReturnValue({
                                    or: vi.fn().mockResolvedValue({ data: overrides, error: null })
                                })
                            })
                        })
                    })
                })
            };
            mockGetClient.mockReturnValue(mockClient as any);

            const result = await getActiveOverrides("org_123");

            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap()).toEqual(overrides);
        });

        it("returns empty array when no overrides exist", async () => {
            const mockClient = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            is: vi.fn().mockReturnValue({
                                lte: vi.fn().mockReturnValue({
                                    or: vi.fn().mockResolvedValue({ data: [], error: null })
                                })
                            })
                        })
                    })
                })
            };
            mockGetClient.mockReturnValue(mockClient as any);

            const result = await getActiveOverrides("org_123");

            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap()).toEqual([]);
        });
    });

    describe("getOverrideHistory", () => {
        it("returns all overrides including expired/revoked", async () => {
            const overrides = [
                {
                    id: "ovr_2",
                    org_id: "org_123",
                    sku: "2025-02-05:docs-team",
                    added_by: "admin@fern.com",
                    start_date: "2026-03-01T00:00:00Z",
                    end_date: null,
                    notes: null,
                    created_at: "2026-03-05T00:00:00Z",
                    revoked_at: "2026-03-08T00:00:00Z"
                },
                {
                    id: "ovr_1",
                    org_id: "org_123",
                    sku: "legacy:custom-enterprise",
                    added_by: "admin@fern.com",
                    start_date: "2026-01-01T00:00:00Z",
                    end_date: "2026-02-01T00:00:00Z",
                    notes: "Temporary upgrade",
                    created_at: "2026-01-01T00:00:00Z",
                    revoked_at: null
                }
            ];
            const mockClient = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({ data: overrides, error: null })
                        })
                    })
                })
            };
            mockGetClient.mockReturnValue(mockClient as any);

            const result = await getOverrideHistory("org_123");

            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap()).toHaveLength(2);
        });
    });

    describe("revokeBillingOverride", () => {
        it("sets revoked_at on the override", async () => {
            const revoked = {
                id: "ovr_1",
                org_id: "org_123",
                sku: "2025-02-05:docs-team",
                added_by: "admin@fern.com",
                start_date: "2026-03-01T00:00:00Z",
                end_date: null,
                notes: null,
                created_at: "2026-03-01T00:00:00Z",
                revoked_at: "2026-03-09T00:00:00Z"
            };
            const mockClient = {
                from: vi.fn().mockReturnValue({
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({ data: revoked, error: null })
                            })
                        })
                    })
                })
            };
            mockGetClient.mockReturnValue(mockClient as any);

            const result = await revokeBillingOverride("ovr_1");

            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap().revoked_at).not.toBeNull();
        });

        it("returns error when override not found", async () => {
            const mockClient = {
                from: vi.fn().mockReturnValue({
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } })
                            })
                        })
                    })
                })
            };
            mockGetClient.mockReturnValue(mockClient as any);

            const result = await revokeBillingOverride("nonexistent");

            expect(result.isErr()).toBe(true);
            expect(result._unsafeUnwrapErr().code).toBe("QUERY_FAILED");
        });
    });
});
