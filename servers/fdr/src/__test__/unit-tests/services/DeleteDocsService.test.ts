import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteDocsServiceImpl } from "../../../services/docs/DeleteDocsService";
import { ParsedBaseUrl } from "../../../util/ParsedBaseUrl";

function createMockApp() {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        },
        config: {
            localModeOverride: false
        },
        services: {
            s3: {
                deleteDocsAssetsByDomain: vi.fn().mockResolvedValue({ deletedCount: 3 })
            },
            revalidator: {
                revalidate: vi.fn().mockResolvedValue({
                    successful: [],
                    failed: [],
                    revalidationFailed: false
                })
            }
        },
        dao: {
            docsV2: vi.fn().mockReturnValue({
                deleteDocsSite: vi.fn().mockResolvedValue({
                    deletedUrls: [{ domain: "docs.example.com", path: "" }]
                }),
                listAllDocsUrlsForOrg: vi.fn().mockResolvedValue([])
            }),
            docsSite: vi.fn().mockReturnValue({
                deleteDocsSite: vi.fn().mockResolvedValue({ count: 1 })
            })
        },
        docsDefinitionCache: {
            invalidateCache: vi.fn().mockResolvedValue(undefined)
        }
    };
}

describe("DeleteDocsServiceImpl", () => {
    let mockApp: ReturnType<typeof createMockApp>;
    let service: DeleteDocsServiceImpl;

    beforeEach(() => {
        vi.clearAllMocks();
        mockApp = createMockApp();
        service = new DeleteDocsServiceImpl(mockApp as any);
    });

    describe("deleteDocsSite", () => {
        it("should delete S3 assets, DocsV2 records, DocsSite record, and invalidate caches", async () => {
            const url = ParsedBaseUrl.parse("docs.example.com");

            await service.deleteDocsSite({
                url,
                orgId: "test-org",
                isPreview: false
            });

            expect(mockApp.services.s3.deleteDocsAssetsByDomain).toHaveBeenCalledWith({
                domain: "docs.example.com"
            });
            expect(mockApp.dao.docsV2().deleteDocsSite).toHaveBeenCalledWith({ url });
            expect(mockApp.dao.docsSite().deleteDocsSite).toHaveBeenCalledWith({
                orgId: "test-org",
                domain: "docs.example.com",
                basepath: undefined
            });
            expect(mockApp.docsDefinitionCache.invalidateCache).toHaveBeenCalled();
            expect(mockApp.services.revalidator.revalidate).toHaveBeenCalled();
        });

        it("should invalidate caches for all sibling URLs (custom domain deletion)", async () => {
            const deletedUrls = [
                { domain: "custom.example.com", path: "" },
                { domain: "org.docs.buildwithfern.com", path: "" }
            ];
            mockApp.dao.docsV2().deleteDocsSite.mockResolvedValue({ deletedUrls });

            const url = ParsedBaseUrl.parse("custom.example.com");

            await service.deleteDocsSite({
                url,
                orgId: "test-org",
                isPreview: false
            });

            expect(mockApp.docsDefinitionCache.invalidateCache).toHaveBeenCalledTimes(2);
            expect(mockApp.services.revalidator.revalidate).toHaveBeenCalledTimes(2);
        });

        it("should handle revalidator errors gracefully", async () => {
            mockApp.services.revalidator.revalidate.mockRejectedValue(new Error("revalidation failed"));

            const url = ParsedBaseUrl.parse("docs.example.com");

            await expect(
                service.deleteDocsSite({
                    url,
                    orgId: "test-org",
                    isPreview: false
                })
            ).resolves.not.toThrow();

            expect(mockApp.logger.warn).toHaveBeenCalled();
        });
    });

    describe("deleteAllDocsSitesForOrg", () => {
        it("should return deletedCount 0 when org has no docs sites", async () => {
            mockApp.dao.docsV2().listAllDocsUrlsForOrg.mockResolvedValue([]);

            const result = await service.deleteAllDocsSitesForOrg({ orgId: "empty-org" });

            expect(result).toEqual({ deletedCount: 0 });
        });

        it("should delete all docs sites for an org", async () => {
            mockApp.dao.docsV2().listAllDocsUrlsForOrg.mockResolvedValue([
                { domain: "docs1.example.com", path: "", isPreview: false },
                { domain: "docs2.example.com", path: "/v2", isPreview: false }
            ]);

            const result = await service.deleteAllDocsSitesForOrg({ orgId: "test-org" });

            expect(result).toEqual({ deletedCount: 2 });
        });

        it("should process in batches with concurrency limit", async () => {
            // Create 8 docs sites to test batching (CONCURRENCY_LIMIT = 5)
            const docs = Array.from({ length: 8 }, (_, i) => ({
                domain: `docs${i}.example.com`,
                path: "",
                isPreview: false
            }));
            mockApp.dao.docsV2().listAllDocsUrlsForOrg.mockResolvedValue(docs);

            const result = await service.deleteAllDocsSitesForOrg({ orgId: "test-org" });

            expect(result).toEqual({ deletedCount: 8 });
            // S3 delete should have been called 8 times (once per doc)
            expect(mockApp.services.s3.deleteDocsAssetsByDomain).toHaveBeenCalledTimes(8);
        });

        it("should count failures and continue processing remaining sites", async () => {
            mockApp.dao.docsV2().listAllDocsUrlsForOrg.mockResolvedValue([
                { domain: "docs1.example.com", path: "", isPreview: false },
                { domain: "docs2.example.com", path: "", isPreview: false },
                { domain: "docs3.example.com", path: "", isPreview: false }
            ]);

            // Make the second deletion fail
            let callCount = 0;
            mockApp.services.s3.deleteDocsAssetsByDomain.mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    return Promise.reject(new Error("S3 delete failed"));
                }
                return Promise.resolve({ deletedCount: 1 });
            });

            const result = await service.deleteAllDocsSitesForOrg({ orgId: "test-org" });

            expect(result).toEqual({ deletedCount: 2 });
            expect(mockApp.logger.error).toHaveBeenCalled();
        });
    });
});
