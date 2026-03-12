import type { Json } from "@fern-platform/supabase";
import { describe, expect, it } from "vitest";

import { mergeSnapshotPatch } from "../repository";

describe("mergeSnapshotPatch", () => {
    describe("pageRegistry key-level merge", () => {
        it("should merge new page entries into existing registry", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1", status: "unchanged" },
                    "page2.mdx": { mdx: "# Page 2", status: "unchanged" }
                } as Json
            };

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page3.mdx": { mdx: "# Page 3", status: "changed" }
                } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Page 1", status: "unchanged" });
            expect(registry["page2.mdx"]).toEqual({ mdx: "# Page 2", status: "unchanged" });
            expect(registry["page3.mdx"]).toEqual({ mdx: "# Page 3", status: "changed" });
        });

        it("should overwrite existing page entries with patch entries", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Original", status: "unchanged" }
                } as Json
            };

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Updated", status: "changed" }
                } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Updated", status: "changed" });
        });

        it("should preserve untouched pages when updating one page", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1" },
                    "page2.mdx": { mdx: "# Page 2" },
                    "page3.mdx": { mdx: "# Page 3" }
                } as Json,
                rootNode: { type: "root" } as Json
            };

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page2.mdx": { mdx: "# Page 2 Updated" }
                } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Page 1" });
            expect(registry["page2.mdx"]).toEqual({ mdx: "# Page 2 Updated" });
            expect(registry["page3.mdx"]).toEqual({ mdx: "# Page 3" });
            expect(result.rootNode).toEqual({ type: "root" });
        });

        it("should create pageRegistry if it does not exist in existing data", () => {
            const existing: Record<string, Json | undefined> = {};

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1" }
                } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Page 1" });
        });
    });

    describe("deletedPageFilenames", () => {
        it("should remove specified pages from registry", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1" },
                    "page2.mdx": { mdx: "# Page 2" },
                    "page3.mdx": { mdx: "# Page 3" }
                } as Json
            };

            const patch: Record<string, Json> = {
                deletedPageFilenames: ["page2.mdx"] as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toBeDefined();
            expect(registry["page2.mdx"]).toBeUndefined();
            expect(registry["page3.mdx"]).toBeDefined();
        });

        it("should handle deleting from empty registry gracefully", () => {
            const existing: Record<string, Json | undefined> = {};

            const patch: Record<string, Json> = {
                deletedPageFilenames: ["nonexistent.mdx"] as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            expect(result.pageRegistry).toBeDefined();
        });

        it("should handle both pageRegistry merge and deletion in same patch", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1" },
                    "page2.mdx": { mdx: "# Page 2" }
                } as Json
            };

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page3.mdx": { mdx: "# Page 3" }
                } as Json,
                deletedPageFilenames: ["page1.mdx"] as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toBeUndefined();
            expect(registry["page2.mdx"]).toEqual({ mdx: "# Page 2" });
            expect(registry["page3.mdx"]).toEqual({ mdx: "# Page 3" });
        });

        it("should handle deleting multiple pages at once", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: {
                    "a.mdx": { mdx: "a" },
                    "b.mdx": { mdx: "b" },
                    "c.mdx": { mdx: "c" },
                    "d.mdx": { mdx: "d" }
                } as Json
            };

            const patch: Record<string, Json> = {
                deletedPageFilenames: ["a.mdx", "c.mdx"] as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["a.mdx"]).toBeUndefined();
            expect(registry["b.mdx"]).toEqual({ mdx: "b" });
            expect(registry["c.mdx"]).toBeUndefined();
            expect(registry["d.mdx"]).toEqual({ mdx: "d" });
        });
    });

    describe("top-level field merge", () => {
        it("should merge top-level fields from patch", () => {
            const existing: Record<string, Json | undefined> = {
                rootNode: { type: "root", version: "v1" } as Json,
                version: 1 as Json
            };

            const patch: Record<string, Json> = {
                rootNode: { type: "root", version: "v2" } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            expect(result.rootNode).toEqual({ type: "root", version: "v2" });
            expect(result.version).toBe(1);
        });

        it("should add new top-level fields", () => {
            const existing: Record<string, Json | undefined> = {
                version: 0 as Json
            };

            const patch: Record<string, Json> = {
                lastCommittedHash: "abc123" as Json,
                metadata: { orgName: "test-org", docsUrl: "https://test.com" } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            expect(result.lastCommittedHash).toBe("abc123");
            expect(result.metadata).toEqual({ orgName: "test-org", docsUrl: "https://test.com" });
            expect(result.version).toBe(0);
        });

        it("should set schemaVersion from parameter", () => {
            const existing: Record<string, Json | undefined> = {};
            const patch: Record<string, Json> = {};

            const result = mergeSnapshotPatch(existing, patch, 2);

            expect(result.schemaVersion).toBe(2);
        });

        it("should override existing schemaVersion", () => {
            const existing: Record<string, Json | undefined> = {
                schemaVersion: 1 as Json
            };
            const patch: Record<string, Json> = {};

            const result = mergeSnapshotPatch(existing, patch, 3);

            expect(result.schemaVersion).toBe(3);
        });
    });

    describe("edge cases", () => {
        it("should handle empty existing data and empty patch", () => {
            const result = mergeSnapshotPatch({}, {}, 2);

            expect(result.schemaVersion).toBe(2);
        });

        it("should preserve all existing fields when patch is empty", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: { "page1.mdx": { mdx: "# Page 1" } } as Json,
                rootNode: { type: "root" } as Json,
                version: 5 as Json,
                metadata: { orgName: "org" } as Json
            };

            const result = mergeSnapshotPatch(existing, {}, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Page 1" });
            expect(result.rootNode).toEqual({ type: "root" });
            expect(result.version).toBe(5);
            expect(result.metadata).toEqual({ orgName: "org" });
        });

        it("should handle non-object pageRegistry in existing data gracefully", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: "invalid" as Json
            };

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1" }
                } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Page 1" });
        });

        it("should handle array pageRegistry in existing data gracefully", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: [1, 2, 3] as Json
            };

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1" }
                } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Page 1" });
        });

        it("should handle null pageRegistry in existing data", () => {
            const existing: Record<string, Json | undefined> = {
                pageRegistry: null as Json
            };

            const patch: Record<string, Json> = {
                pageRegistry: {
                    "page1.mdx": { mdx: "# Page 1" }
                } as Json
            };

            const result = mergeSnapshotPatch(existing, patch, 2);

            const registry = result.pageRegistry as Record<string, Json | undefined>;
            expect(registry["page1.mdx"]).toEqual({ mdx: "# Page 1" });
        });
    });
});
