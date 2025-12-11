import type { FernAIClient } from "@fern-api/fai-sdk";
import { describe, expect, it, vi } from "vitest";
import {
    computeContentHash,
    deleteContentHashes,
    getContentDiff,
    getContentHashesForDomain,
    upsertContentHashes
} from "../content-diff";
import { chunkMarkdown } from "../turbopuffer/records/create-markdown-records";

const FULL_MARKDOWN_DOC = `# Getting Started

This is an introduction to our API.

## Authentication

You can authenticate using an API key:

\`\`\`typescript
const client = new Client({ apiKey: 'your-key' });
\`\`\`

### API Key Generation

To generate an API key:
1. Go to the dashboard
2. Click "Generate Key"
3. Copy your key

### Security Best Practices

Never expose your API key in client-side code.

## Making Requests

Use the client to make requests:

\`\`\`typescript
const response = await client.users.list();
\`\`\`

### Pagination

Results are paginated by default.

### Error Handling

Handle errors using try-catch blocks.

## Rate Limiting

API calls are rate limited to 100 requests per minute.`;

const HALF_MARKDOWN_DOC = `# Getting Started

This is an introduction to our API.

## Authentication

You can authenticate using an API key:

\`\`\`typescript
const client = new Client({ apiKey: 'your-key' });
\`\`\`

### API Key Generation

To generate an API key:
1. Go to the dashboard
2. Click "Generate Key"
3. Copy your key

### Security Best Practices

Never expose your API key in client-side code.`;

const FULL_DOC_CHUNKS = chunkMarkdown(FULL_MARKDOWN_DOC);
const HALF_DOC_CHUNKS = chunkMarkdown(HALF_MARKDOWN_DOC);

const FULL_DOC_CHUNK_COUNT = FULL_DOC_CHUNKS.length;
const HALF_DOC_CHUNK_COUNT = HALF_DOC_CHUNKS.length;

describe("content-diff", () => {
    describe("computeContentHash", () => {
        it("should compute SHA-256 hash of content", () => {
            const content = "Hello, World!";
            const hash = computeContentHash(content);

            // SHA-256 of "Hello, World!"
            expect(hash).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
        });

        it("should return same hash for same content", () => {
            const content = "test content";
            const hash1 = computeContentHash(content);
            const hash2 = computeContentHash(content);

            expect(hash1).toBe(hash2);
        });

        it("should return different hashes for different content", () => {
            const hash1 = computeContentHash("content1");
            const hash2 = computeContentHash("content2");

            expect(hash1).not.toBe(hash2);
        });

        it("should compute different hashes for full vs half markdown doc", () => {
            const fullHash = computeContentHash(FULL_MARKDOWN_DOC);
            const halfHash = computeContentHash(HALF_MARKDOWN_DOC);

            expect(fullHash).not.toBe(halfHash);
        });

        it("should verify chunk counts using real chunking algorithm", () => {
            expect(FULL_DOC_CHUNK_COUNT).toBe(8);

            expect(HALF_DOC_CHUNK_COUNT).toBe(4);
        });
    });

    describe("getContentHashesForDomain", () => {
        it("should fetch all content hashes with pagination", async () => {
            const mockClient = {
                contentHash: {
                    batchGetContentHashes: vi.fn()
                }
            } as unknown as FernAIClient;

            // Mock pagination: 2500 total records across 3 pages
            // Page 1: offset=0, returns 1000 records
            // Page 2: offset=1000, returns 1000 records
            // Page 3: offset=2000, returns 500 records
            vi.mocked(mockClient.contentHash.batchGetContentHashes)
                .mockResolvedValueOnce({
                    entries: Array.from({ length: 1000 }, (_, i) => ({
                        domain: "example.com",
                        parent_id: `page${i}`,
                        content_hash: `hash${i}`,
                        chunk_count: i % 10
                    })),
                    has_more: true,
                    total_count: 2500
                })
                .mockResolvedValueOnce({
                    entries: Array.from({ length: 1000 }, (_, i) => ({
                        domain: "example.com",
                        parent_id: `page${i + 1000}`,
                        content_hash: `hash${i + 1000}`,
                        chunk_count: (i + 1000) % 10
                    })),
                    has_more: true,
                    total_count: 2500
                })
                .mockResolvedValueOnce({
                    entries: Array.from({ length: 500 }, (_, i) => ({
                        domain: "example.com",
                        parent_id: `page${i + 2000}`,
                        content_hash: `hash${i + 2000}`,
                        chunk_count: (i + 2000) % 10
                    })),
                    has_more: false,
                    total_count: 2500
                });

            const result = await getContentHashesForDomain("example.com", mockClient);

            expect(result.size).toBe(2500);
            expect(result.get("page0")).toEqual({ content_hash: "hash0", chunk_count: 0 });
            expect(result.get("page1000")).toEqual({ content_hash: "hash1000", chunk_count: 0 });
            expect(result.get("page2000")).toEqual({ content_hash: "hash2000", chunk_count: 0 });

            expect(mockClient.contentHash.batchGetContentHashes).toHaveBeenCalledTimes(3);
            expect(mockClient.contentHash.batchGetContentHashes).toHaveBeenNthCalledWith(1, "example.com", {
                parent_ids: [],
                limit: 1000,
                offset: 0
            });
            expect(mockClient.contentHash.batchGetContentHashes).toHaveBeenNthCalledWith(2, "example.com", {
                parent_ids: [],
                limit: 1000,
                offset: 1000
            });
            expect(mockClient.contentHash.batchGetContentHashes).toHaveBeenNthCalledWith(3, "example.com", {
                parent_ids: [],
                limit: 1000,
                offset: 2000
            });
        });

        it("should handle empty results", async () => {
            const mockClient = {
                contentHash: {
                    batchGetContentHashes: vi.fn().mockResolvedValue({
                        entries: [],
                        has_more: false,
                        total_count: 0
                    })
                }
            } as unknown as FernAIClient;

            const result = await getContentHashesForDomain("example.com", mockClient);

            expect(result.size).toBe(0);
        });
    });

    describe("getContentDiff - Real Markdown Scenarios", () => {
        describe("Scenario 1: Add full document (starting from nothing)", () => {
            it("should detect all content as added with correct chunk count", async () => {
                const mockClient = {
                    contentHash: {
                        batchGetContentHashes: vi.fn().mockResolvedValue({
                            entries: [],
                            has_more: false,
                            total_count: 0
                        })
                    }
                } as unknown as FernAIClient;

                const currentContent = new Map([
                    ["getting-started", { content: FULL_MARKDOWN_DOC, chunk_count: FULL_DOC_CHUNK_COUNT }]
                ]);

                const { diff } = await getContentDiff("example.com", currentContent, mockClient);

                expect(diff.added).toHaveLength(1);
                expect(diff.added[0]).toEqual({
                    parent_id: "getting-started",
                    content: FULL_MARKDOWN_DOC,
                    content_hash: computeContentHash(FULL_MARKDOWN_DOC),
                    chunk_count: FULL_DOC_CHUNK_COUNT
                });
                expect(diff.updated).toHaveLength(0);
                expect(diff.deleted).toHaveLength(0);
                expect(diff.unchanged).toHaveLength(0);
            });
        });

        describe("Scenario 2: Expand half document to full", () => {
            it("should detect content as updated with increased chunk count", async () => {
                const mockClient = {
                    contentHash: {
                        batchGetContentHashes: vi.fn().mockResolvedValue({
                            entries: [
                                {
                                    domain: "example.com",
                                    parent_id: "getting-started",
                                    content_hash: computeContentHash(HALF_MARKDOWN_DOC),
                                    chunk_count: HALF_DOC_CHUNK_COUNT
                                }
                            ],
                            has_more: false,
                            total_count: 1
                        })
                    }
                } as unknown as FernAIClient;

                const currentContent = new Map([
                    ["getting-started", { content: FULL_MARKDOWN_DOC, chunk_count: FULL_DOC_CHUNK_COUNT }]
                ]);

                const { diff } = await getContentDiff("example.com", currentContent, mockClient);

                expect(diff.added).toHaveLength(0);
                expect(diff.updated).toHaveLength(1);
                expect(diff.updated[0]).toEqual({
                    parent_id: "getting-started",
                    content: FULL_MARKDOWN_DOC,
                    content_hash: computeContentHash(FULL_MARKDOWN_DOC),
                    chunk_count: FULL_DOC_CHUNK_COUNT
                });
                expect(diff.deleted).toHaveLength(0);
                expect(diff.unchanged).toHaveLength(0);
            });
        });

        describe("Scenario 3: Delete full document", () => {
            it("should detect all content as deleted", async () => {
                const mockClient = {
                    contentHash: {
                        batchGetContentHashes: vi.fn().mockResolvedValue({
                            entries: [
                                {
                                    domain: "example.com",
                                    parent_id: "getting-started",
                                    content_hash: computeContentHash(FULL_MARKDOWN_DOC),
                                    chunk_count: FULL_DOC_CHUNK_COUNT
                                }
                            ],
                            has_more: false,
                            total_count: 1
                        })
                    }
                } as unknown as FernAIClient;

                const currentContent = new Map();

                const { diff } = await getContentDiff("example.com", currentContent, mockClient);

                expect(diff.added).toHaveLength(0);
                expect(diff.updated).toHaveLength(0);
                expect(diff.deleted).toHaveLength(1);
                expect(diff.deleted).toEqual(["getting-started"]);
                expect(diff.unchanged).toHaveLength(0);
            });
        });

        describe("Scenario 4: No changes (full document unchanged)", () => {
            it("should detect no changes when content is identical", async () => {
                const mockClient = {
                    contentHash: {
                        batchGetContentHashes: vi.fn().mockResolvedValue({
                            entries: [
                                {
                                    domain: "example.com",
                                    parent_id: "getting-started",
                                    content_hash: computeContentHash(FULL_MARKDOWN_DOC),
                                    chunk_count: FULL_DOC_CHUNK_COUNT
                                }
                            ],
                            has_more: false,
                            total_count: 1
                        })
                    }
                } as unknown as FernAIClient;

                const currentContent = new Map([
                    ["getting-started", { content: FULL_MARKDOWN_DOC, chunk_count: FULL_DOC_CHUNK_COUNT }]
                ]);

                const { diff } = await getContentDiff("example.com", currentContent, mockClient);

                expect(diff.added).toHaveLength(0);
                expect(diff.updated).toHaveLength(0);
                expect(diff.deleted).toHaveLength(0);
                expect(diff.unchanged).toHaveLength(1);
                expect(diff.unchanged).toEqual(["getting-started"]);
            });
        });
    });

    describe("upsertContentHashes", () => {
        it("should batch upserts in groups of 1000", async () => {
            const mockClient = {
                contentHash: {
                    batchUpsertContentHashes: vi.fn().mockResolvedValue({})
                }
            } as unknown as FernAIClient;

            const items = Array.from({ length: 2500 }, (_, i) => ({
                parent_id: `page${i}`,
                content: `content${i}`,
                content_hash: `hash${i}`,
                chunk_count: i % 10
            }));

            await upsertContentHashes("example.com", items, mockClient);

            expect(mockClient.contentHash.batchUpsertContentHashes).toHaveBeenCalledTimes(3);

            expect(mockClient.contentHash.batchUpsertContentHashes).toHaveBeenNthCalledWith(1, "example.com", {
                entries: expect.arrayContaining([{ parent_id: "page0", content_hash: "hash0", chunk_count: 0 }])
            });
            expect(vi.mocked(mockClient.contentHash.batchUpsertContentHashes).mock.calls[0][1].entries).toHaveLength(
                1000
            );

            expect(vi.mocked(mockClient.contentHash.batchUpsertContentHashes).mock.calls[1][1].entries).toHaveLength(
                1000
            );

            expect(vi.mocked(mockClient.contentHash.batchUpsertContentHashes).mock.calls[2][1].entries).toHaveLength(
                500
            );
        });

        it("should handle empty items array", async () => {
            const mockClient = {
                contentHash: {
                    batchUpsertContentHashes: vi.fn()
                }
            } as unknown as FernAIClient;

            await upsertContentHashes("example.com", [], mockClient);

            expect(mockClient.contentHash.batchUpsertContentHashes).not.toHaveBeenCalled();
        });

        it("should handle items less than batch size", async () => {
            const mockClient = {
                contentHash: {
                    batchUpsertContentHashes: vi.fn().mockResolvedValue({})
                }
            } as unknown as FernAIClient;

            const items = [
                { parent_id: "page1", content: "c1", content_hash: "hash1", chunk_count: 5 },
                { parent_id: "page2", content: "c2", content_hash: "hash2", chunk_count: 3 }
            ];

            await upsertContentHashes("example.com", items, mockClient);

            expect(mockClient.contentHash.batchUpsertContentHashes).toHaveBeenCalledTimes(1);
            expect(mockClient.contentHash.batchUpsertContentHashes).toHaveBeenCalledWith("example.com", {
                entries: [
                    { parent_id: "page1", content_hash: "hash1", chunk_count: 5 },
                    { parent_id: "page2", content_hash: "hash2", chunk_count: 3 }
                ]
            });
        });
    });

    describe("deleteContentHashes", () => {
        it("should delete content hashes for given parent_ids", async () => {
            const mockClient = {
                contentHash: {
                    deleteContentHashes: vi.fn().mockResolvedValue({})
                }
            } as unknown as FernAIClient;

            await deleteContentHashes("example.com", ["page1", "page2", "page3"], mockClient);

            expect(mockClient.contentHash.deleteContentHashes).toHaveBeenCalledTimes(1);
            expect(mockClient.contentHash.deleteContentHashes).toHaveBeenCalledWith("example.com", {
                parent_ids: ["page1", "page2", "page3"]
            });
        });

        it("should handle empty parent_ids array", async () => {
            const mockClient = {
                contentHash: {
                    deleteContentHashes: vi.fn()
                }
            } as unknown as FernAIClient;

            await deleteContentHashes("example.com", [], mockClient);

            expect(mockClient.contentHash.deleteContentHashes).not.toHaveBeenCalled();
        });
    });
});
