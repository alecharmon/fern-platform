import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { turbopufferUpsertTask } from "../turbopuffer/tasks/turbopuffer-indexer-task";

// Mock dependencies
vi.mock("@fern-docs/search-utils", () => ({
    loadDocsWithUrl: vi.fn()
}));

vi.mock("../turbopuffer/records/create-turbopuffer-records", () => ({
    createTurbopufferRecords: vi.fn()
}));

vi.mock("../turbopuffer/records/vectorize-turbopuffer-records", () => ({
    vectorizeTurbopufferRecords: vi.fn()
}));

vi.mock("@turbopuffer/turbopuffer", () => ({
    Turbopuffer: vi.fn()
}));

import { loadDocsWithUrl } from "@fern-docs/search-utils";
import { createTurbopufferRecords } from "../turbopuffer/records/create-turbopuffer-records";
import { vectorizeTurbopufferRecords } from "../turbopuffer/records/vectorize-turbopuffer-records";

const loadDocsWithUrlMock = loadDocsWithUrl as ReturnType<typeof vi.fn>;
const createTurbopufferRecordsMock = createTurbopufferRecords as ReturnType<typeof vi.fn>;
const vectorizeTurbopufferRecordsMock = vectorizeTurbopufferRecords as ReturnType<typeof vi.fn>;
const TurbopufferMock = Turbopuffer as ReturnType<typeof vi.fn>;

describe("turbopufferUpsertTask - halve-batch-on-failure logic", () => {
    let upsertMock: ReturnType<typeof vi.fn>;
    let deleteAllMock: ReturnType<typeof vi.fn>;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup console spy to suppress logs
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        // Mock loadDocsWithUrl
        loadDocsWithUrlMock.mockResolvedValue({
            root: {},
            pages: [],
            apis: [],
            domain: "test.docs.com"
        });

        // Mock createTurbopufferRecords
        createTurbopufferRecordsMock.mockResolvedValue([]);

        // Mock Turbopuffer namespace methods
        upsertMock = vi.fn().mockResolvedValue(undefined);
        deleteAllMock = vi.fn().mockResolvedValue(undefined);

        TurbopufferMock.mockImplementation(() => ({
            namespace: vi.fn().mockReturnValue({
                upsert: upsertMock,
                deleteAll: deleteAllMock
            })
        }));
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("should successfully upsert with default batch size (2000)", async () => {
        // Create 3000 records
        const records = Array.from({ length: 3000 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await turbopufferUpsertTask({
            apiKey: "test-key",
            namespace: "test-ns",
            payload: { url: "https://test.com" } as any,
            vectorizer
        });

        // Should make 2 calls: 2000 + 1000
        expect(upsertMock).toHaveBeenCalledTimes(2);
        expect(upsertMock.mock.calls[0]![0].vectors).toHaveLength(2000);
        expect(upsertMock.mock.calls[1]![0].vectors).toHaveLength(1000);
    });

    it("should halve batch size on string length error and retry", async () => {
        // Create 2000 records
        const records = Array.from({ length: 2000 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        // First call fails with string length error, second succeeds
        upsertMock
            .mockRejectedValueOnce(new RangeError("Invalid string length"))
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await turbopufferUpsertTask({
            apiKey: "test-key",
            namespace: "test-ns",
            payload: { url: "https://test.com" } as any,
            vectorizer
        });

        // Should make 3 calls: 2000 (fails), 1000 (succeeds), 1000 (succeeds)
        expect(upsertMock).toHaveBeenCalledTimes(3);
        expect(upsertMock.mock.calls[0]![0].vectors).toHaveLength(2000); // First attempt
        expect(upsertMock.mock.calls[1]![0].vectors).toHaveLength(1000); // Retry with halved
        expect(upsertMock.mock.calls[2]![0].vectors).toHaveLength(1000); // Remaining batch

        // Verify console logs show the retry
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("reducing batch size to 1000"));
    });

    it("should halve multiple times until success", async () => {
        // Create 2000 records
        const records = Array.from({ length: 2000 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        // Fail on 2000, fail on 1000, succeed on 500
        upsertMock
            .mockRejectedValueOnce(new RangeError("Invalid string length"))
            .mockRejectedValueOnce(new RangeError("string length exceeded"))
            .mockResolvedValue(undefined);

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await turbopufferUpsertTask({
            apiKey: "test-key",
            namespace: "test-ns",
            payload: { url: "https://test.com" } as any,
            vectorizer
        });

        // Should make 4 calls: 2000 (fail), 1000 (fail), 500 (success), 1500 (success with reset)
        expect(upsertMock).toHaveBeenCalledTimes(4);
        expect(upsertMock.mock.calls[0]![0].vectors).toHaveLength(2000); // First attempt
        expect(upsertMock.mock.calls[1]![0].vectors).toHaveLength(1000); // Halved
        expect(upsertMock.mock.calls[2]![0].vectors).toHaveLength(500); // Halved again (processes 0-499)
        expect(upsertMock.mock.calls[3]![0].vectors).toHaveLength(1500); // Remaining with reset batch size
    });

    it("should reset to default batch size after successful upsert", async () => {
        // Create 3000 records
        const records = Array.from({ length: 3000 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        // First batch fails, retry succeeds, third batch should use default size
        upsertMock.mockRejectedValueOnce(new RangeError("Invalid string length")).mockResolvedValue(undefined);

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await turbopufferUpsertTask({
            apiKey: "test-key",
            namespace: "test-ns",
            payload: { url: "https://test.com" } as any,
            vectorizer
        });

        // Should make 3 calls: 2000 (fail), 1000 (success for 0-999), 2000 (success with reset for 1000-2999)
        expect(upsertMock).toHaveBeenCalledTimes(3);
        expect(upsertMock.mock.calls[0]![0].vectors).toHaveLength(2000); // First attempt
        expect(upsertMock.mock.calls[1]![0].vectors).toHaveLength(1000); // Retry halved (processes 0-999)
        expect(upsertMock.mock.calls[2]![0].vectors).toHaveLength(2000); // Remaining with reset batch size (processes 1000-2999)
    });

    it("should throw error when batch size reaches minimum and still fails", async () => {
        // Create 500 records (one batch at minimum size)
        const records = Array.from({ length: 500 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        // Keep failing even at minimum batch size
        upsertMock.mockRejectedValue(new RangeError("Invalid string length"));

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await expect(
            turbopufferUpsertTask({
                apiKey: "test-key",
                namespace: "test-ns",
                payload: { url: "https://test.com" } as any,
                vectorizer
            })
        ).rejects.toThrow("Invalid string length");

        // Should only try once at min size, then throw
        expect(upsertMock).toHaveBeenCalledTimes(1);
    });

    it("should immediately throw non-string-length errors", async () => {
        const records = Array.from({ length: 2000 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        // Throw a different error type
        upsertMock.mockRejectedValue(new Error("Network error"));

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await expect(
            turbopufferUpsertTask({
                apiKey: "test-key",
                namespace: "test-ns",
                payload: { url: "https://test.com" } as any,
                vectorizer
            })
        ).rejects.toThrow("Network error");

        // Should only try once, no retry
        expect(upsertMock).toHaveBeenCalledTimes(1);
        expect(upsertMock.mock.calls[0]![0].vectors).toHaveLength(2000);
    });

    it("should handle different RangeError messages for string length", async () => {
        const records = Array.from({ length: 2000 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        // Test both error message patterns
        upsertMock.mockRejectedValueOnce(new RangeError("string length too large")).mockResolvedValue(undefined);

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await turbopufferUpsertTask({
            apiKey: "test-key",
            namespace: "test-ns",
            payload: { url: "https://test.com" } as any,
            vectorizer
        });

        expect(upsertMock).toHaveBeenCalledTimes(3); // Fail, retry, remaining
    });

    it("should not retry TypeError even with string length in message", async () => {
        const records = Array.from({ length: 2000 }, (_, i) => ({
            id: `record-${i}`,
            vector: [0.1, 0.2, 0.3],
            attributes: {}
        }));

        vectorizeTurbopufferRecordsMock.mockResolvedValue(records);

        // TypeError (not RangeError) should not trigger retry
        upsertMock.mockRejectedValue(new TypeError("Invalid string length"));

        const vectorizer = vi.fn().mockResolvedValue([[0.1, 0.2]]);

        await expect(
            turbopufferUpsertTask({
                apiKey: "test-key",
                namespace: "test-ns",
                payload: { url: "https://test.com" } as any,
                vectorizer
            })
        ).rejects.toThrow(TypeError);

        // Should only try once
        expect(upsertMock).toHaveBeenCalledTimes(1);
    });
});
