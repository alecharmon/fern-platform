import type { LoadDocsWithUrlPayload } from "@fern-docs/search-utils";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { turbopufferUpsertTask } from "../turbopuffer/tasks/turbopuffer-indexer-task";

vi.mock("@turbopuffer/turbopuffer");
vi.mock("@fern-docs/search-utils", () => ({
    loadDocsWithUrl: vi.fn()
}));
vi.mock("../turbopuffer/records/create-turbopuffer-records", () => ({
    createTurbopufferRecords: vi.fn()
}));
vi.mock("../turbopuffer/records/vectorize-turbopuffer-records", () => ({
    vectorizeTurbopufferRecords: vi.fn()
}));

import { loadDocsWithUrl } from "@fern-docs/search-utils";
import { createTurbopufferRecords } from "../turbopuffer/records/create-turbopuffer-records";
import { vectorizeTurbopufferRecords } from "../turbopuffer/records/vectorize-turbopuffer-records";

describe("turbopufferUpsertTask - deleteExisting with non-existent namespace", () => {
    let mockNamespace: {
        deleteAll: Mock;
        upsert: Mock;
    };

    const mockPayload: LoadDocsWithUrlPayload = {
        domain: "test.test.test",
        environment: "production",
        fernToken: "test-token"
    };

    const mockVectorizer = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);

    beforeEach(() => {
        vi.clearAllMocks();

        mockNamespace = {
            deleteAll: vi.fn(),
            upsert: vi.fn().mockResolvedValue(undefined)
        };

        (Turbopuffer as unknown as Mock).mockImplementation(() => ({
            namespace: vi.fn().mockReturnValue(mockNamespace)
        }));

        (loadDocsWithUrl as Mock).mockResolvedValue({
            root: { type: "root" },
            pages: {},
            apis: {},
            domain: "test.docs.buildwithfern.com"
        });

        (createTurbopufferRecords as Mock).mockResolvedValue([
            { id: "1", chunk: "test chunk 1" },
            { id: "2", chunk: "test chunk 2" }
        ]);

        (vectorizeTurbopufferRecords as Mock).mockResolvedValue([
            { id: "1", vector: [0.1, 0.2, 0.3], chunk: "test chunk 1" },
            { id: "2", vector: [0.4, 0.5, 0.6], chunk: "test chunk 2" }
        ]);
    });

    it("should gracefully handle deleteExisting=true when namespace doesn't exist", async () => {
        mockNamespace.deleteAll.mockRejectedValue(
            new Error("🤷 namespace 'nonexistent.docs.buildwithfern.com_fern_docs' was not found")
        );

        const result = await turbopufferUpsertTask({
            apiKey: "test-api-key",
            namespace: "nonexistent.docs.buildwithfern.com_fern_docs",
            payload: mockPayload,
            vectorizer: mockVectorizer,
            deleteExisting: true
        });

        expect(result).toBe(2);

        expect(mockNamespace.deleteAll).toHaveBeenCalledTimes(1);

        expect(mockNamespace.upsert).toHaveBeenCalledTimes(1);
        expect(mockNamespace.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                distance_metric: "cosine_distance",
                vectors: expect.arrayContaining([
                    expect.objectContaining({ id: "1" }),
                    expect.objectContaining({ id: "2" })
                ])
            })
        );
    });
});
