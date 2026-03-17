import type { TurbopufferRecordWithoutVector } from "@fern-docs/search-utils";
import { describe, expect, it } from "vitest";
import { partitionByContentHash } from "../turbopuffer-incremental-upsert-task";

function makeRecord(
    id: string,
    parentId: string | undefined,
    parentContentHash: string | undefined
): TurbopufferRecordWithoutVector {
    return {
        id,
        attributes: {
            chunk: "chunk text",
            document: "document text",
            title: "Title",
            url: "https://example.com/page",
            parent_id: parentId,
            parent_content_hash: parentContentHash
        }
    };
}

describe("partitionByContentHash", () => {
    it("should treat all records as changed when existingHashes is empty", () => {
        const records = [
            makeRecord("r1", "page1", "hash1"),
            makeRecord("r2", "page1", "hash1"),
            makeRecord("r3", "page2", "hash2")
        ];
        const existingHashes = new Map<string, string>();

        const result = partitionByContentHash(records, existingHashes);

        expect(result.changed).toHaveLength(3);
        expect(result.unchangedParentIds.size).toBe(0);
    });

    it("should skip unchanged records when hashes match", () => {
        const records = [
            makeRecord("r1", "page1", "hash1"),
            makeRecord("r2", "page1", "hash1"),
            makeRecord("r3", "page2", "hash2")
        ];
        const existingHashes = new Map([
            ["page1", "hash1"],
            ["page2", "hash2"]
        ]);

        const result = partitionByContentHash(records, existingHashes);

        expect(result.changed).toHaveLength(0);
        expect(result.unchangedParentIds).toEqual(new Set(["page1", "page2"]));
    });

    it("should include all chunks of a changed page", () => {
        const records = [
            makeRecord("r1", "page1", "new-hash"),
            makeRecord("r2", "page1", "new-hash"),
            makeRecord("r3", "page2", "hash2")
        ];
        const existingHashes = new Map([
            ["page1", "old-hash"],
            ["page2", "hash2"]
        ]);

        const result = partitionByContentHash(records, existingHashes);

        // Both chunks of page1 should be changed
        expect(result.changed).toHaveLength(2);
        expect(result.changed.map((r) => r.id)).toEqual(["r1", "r2"]);
        expect(result.unchangedParentIds).toEqual(new Set(["page2"]));
    });

    it("should treat records with no parent_id as changed", () => {
        const records = [makeRecord("r1", undefined, "hash1")];
        const existingHashes = new Map<string, string>();

        const result = partitionByContentHash(records, existingHashes);

        expect(result.changed).toHaveLength(1);
        expect(result.unchangedParentIds.size).toBe(0);
    });

    it("should treat records with no parent_content_hash as changed", () => {
        const records = [makeRecord("r1", "page1", undefined)];
        const existingHashes = new Map([["page1", "hash1"]]);

        const result = partitionByContentHash(records, existingHashes);

        expect(result.changed).toHaveLength(1);
        expect(result.unchangedParentIds.size).toBe(0);
    });

    it("should treat new pages (not in existingHashes) as changed", () => {
        const records = [makeRecord("r1", "new-page", "hash-new"), makeRecord("r2", "existing-page", "hash-existing")];
        const existingHashes = new Map([["existing-page", "hash-existing"]]);

        const result = partitionByContentHash(records, existingHashes);

        expect(result.changed).toHaveLength(1);
        expect(result.changed[0].id).toBe("r1");
        expect(result.unchangedParentIds).toEqual(new Set(["existing-page"]));
    });

    it("should handle mixed changed and unchanged across multiple parents", () => {
        const records = [
            // page1: unchanged (2 chunks)
            makeRecord("r1", "page1", "hash1"),
            makeRecord("r2", "page1", "hash1"),
            // page2: changed (1 chunk)
            makeRecord("r3", "page2", "new-hash2"),
            // page3: new page (1 chunk)
            makeRecord("r4", "page3", "hash3"),
            // page4: unchanged (1 chunk)
            makeRecord("r5", "page4", "hash4")
        ];
        const existingHashes = new Map([
            ["page1", "hash1"],
            ["page2", "old-hash2"],
            ["page4", "hash4"]
        ]);

        const result = partitionByContentHash(records, existingHashes);

        expect(result.changed).toHaveLength(2);
        expect(result.changed.map((r) => r.id)).toEqual(["r3", "r4"]);
        expect(result.unchangedParentIds).toEqual(new Set(["page1", "page4"]));
    });

    it("should handle empty records array", () => {
        const records: TurbopufferRecordWithoutVector[] = [];
        const existingHashes = new Map([["page1", "hash1"]]);

        const result = partitionByContentHash(records, existingHashes);

        expect(result.changed).toHaveLength(0);
        expect(result.unchangedParentIds.size).toBe(0);
    });

    it("should correctly handle chunks interleaved from different parents", () => {
        const records = [
            makeRecord("r1", "page1", "hash1"),
            makeRecord("r2", "page2", "new-hash2"),
            makeRecord("r3", "page1", "hash1"),
            makeRecord("r4", "page2", "new-hash2")
        ];
        const existingHashes = new Map([
            ["page1", "hash1"],
            ["page2", "old-hash2"]
        ]);

        const result = partitionByContentHash(records, existingHashes);

        // page2's chunks should all be in changed (both r2 and r4)
        expect(result.changed).toHaveLength(2);
        expect(result.changed.map((r) => r.id)).toEqual(["r2", "r4"]);
        expect(result.unchangedParentIds).toEqual(new Set(["page1"]));
    });
});
