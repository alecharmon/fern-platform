import { describe, expect, it, vi } from "vitest";
import { DocsSiteDaoImpl } from "../../db/docs-deployment/DocsSiteDao";

function createMockPrisma() {
    return {
        docsSite: {
            upsert: vi.fn().mockResolvedValue({
                id: "docs_site_123",
                orgId: "test-org",
                domain: "docs.example.com",
                basepath: "",
                previewUrl: null,
                postmanCollectionId: "existing-collection-id",
                status: "PUBLISHING",
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            findFirst: vi.fn(),
            findUnique: vi.fn()
        },
        docsDeployment: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 })
        }
    };
}

describe("DocsSiteDaoImpl", () => {
    describe("registerDocsSite", () => {
        it("should not overwrite postmanCollectionId when not provided", async () => {
            const mockPrisma = createMockPrisma();
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            await dao.registerDocsSite({
                domain: "docs.example.com",
                orgId: "test-org"
            });

            expect(mockPrisma.docsSite.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.not.objectContaining({
                        postmanCollectionId: expect.anything()
                    })
                })
            );

            // Verify the update block only has previewUrl and status
            const call = mockPrisma.docsSite.upsert.mock.calls[0]![0];
            expect(call.update).toEqual({
                previewUrl: undefined,
                status: "PUBLISHING"
            });
        });

        it("should set postmanCollectionId when explicitly provided", async () => {
            const mockPrisma = createMockPrisma();
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            await dao.registerDocsSite({
                domain: "docs.example.com",
                orgId: "test-org",
                postmanCollectionId: "new-collection-id"
            });

            const call = mockPrisma.docsSite.upsert.mock.calls[0]![0];
            expect(call.update).toEqual({
                previewUrl: undefined,
                postmanCollectionId: "new-collection-id",
                status: "PUBLISHING"
            });
        });

        it("should include postmanCollectionId in create block even when not provided", async () => {
            const mockPrisma = createMockPrisma();
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            await dao.registerDocsSite({
                domain: "docs.example.com",
                orgId: "test-org"
            });

            const call = mockPrisma.docsSite.upsert.mock.calls[0]![0];
            expect(call.create.postmanCollectionId).toBeUndefined();
        });

        it("should include postmanCollectionId in create block when provided", async () => {
            const mockPrisma = createMockPrisma();
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            await dao.registerDocsSite({
                domain: "docs.example.com",
                orgId: "test-org",
                postmanCollectionId: "new-collection-id"
            });

            const call = mockPrisma.docsSite.upsert.mock.calls[0]![0];
            expect(call.create.postmanCollectionId).toBe("new-collection-id");
        });
    });

    describe("unlockPublishingDeployments", () => {
        it("should call updateMany with PUBLISHING filter and ERROR status", async () => {
            const mockPrisma = createMockPrisma();
            mockPrisma.docsDeployment.updateMany.mockResolvedValue({ count: 2 });
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            const count = await dao.unlockPublishingDeployments("docs.example.com");

            expect(mockPrisma.docsDeployment.updateMany).toHaveBeenCalledWith({
                where: {
                    domain: "docs.example.com",
                    basepath: "",
                    status: "PUBLISHING"
                },
                data: {
                    status: "ERROR"
                }
            });
            expect(count).toBe(2);
        });

        it("should pass basepath when provided", async () => {
            const mockPrisma = createMockPrisma();
            mockPrisma.docsDeployment.updateMany.mockResolvedValue({ count: 1 });
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            const count = await dao.unlockPublishingDeployments("docs.example.com", "/api");

            expect(mockPrisma.docsDeployment.updateMany).toHaveBeenCalledWith({
                where: {
                    domain: "docs.example.com",
                    basepath: "/api",
                    status: "PUBLISHING"
                },
                data: {
                    status: "ERROR"
                }
            });
            expect(count).toBe(1);
        });

        it("should default basepath to empty string when undefined", async () => {
            const mockPrisma = createMockPrisma();
            mockPrisma.docsDeployment.updateMany.mockResolvedValue({ count: 0 });
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            const count = await dao.unlockPublishingDeployments("docs.example.com", undefined);

            const call = mockPrisma.docsDeployment.updateMany.mock.calls[0]![0];
            expect(call.where.basepath).toBe("");
            expect(count).toBe(0);
        });

        it("should return 0 when no PUBLISHING deployments exist", async () => {
            const mockPrisma = createMockPrisma();
            mockPrisma.docsDeployment.updateMany.mockResolvedValue({ count: 0 });
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            const count = await dao.unlockPublishingDeployments("nonexistent.example.com");

            expect(count).toBe(0);
        });
    });

    describe("deleteDocsSite", () => {
        it("should delete a docs site with default basepath", async () => {
            const mockPrisma = createMockPrisma();
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            await dao.deleteDocsSite({
                orgId: "test-org",
                domain: "docs.example.com"
            });

            expect(mockPrisma.docsSite.deleteMany).toHaveBeenCalledWith({
                where: {
                    orgId: "test-org",
                    domain: "docs.example.com",
                    basepath: ""
                }
            });
        });

        it("should delete a docs site with a specific basepath", async () => {
            const mockPrisma = createMockPrisma();
            const dao = new DocsSiteDaoImpl(mockPrisma as any);

            await dao.deleteDocsSite({
                orgId: "test-org",
                domain: "docs.example.com",
                basepath: "/v2"
            });

            expect(mockPrisma.docsSite.deleteMany).toHaveBeenCalledWith({
                where: {
                    orgId: "test-org",
                    domain: "docs.example.com",
                    basepath: "/v2"
                }
            });
        });
    });
});
