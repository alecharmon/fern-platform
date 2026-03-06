import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../redshift-client", () => ({
    getRedshiftPool: () => ({
        query: mockQuery
    })
}));

import { RedshiftAnalytics } from "../redshift-analytics";

describe("RedshiftAnalytics", () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });
    describe("constructor parsing", () => {
        it("parses domain without path prefix", () => {
            const analytics = new RedshiftAnalytics("api.docs.spscommerce.com");
            expect(analytics["host"]).toBe("api.docs.spscommerce.com");
            expect(analytics["pathPrefix"]).toBeNull();
        });

        it("parses domain with path prefix", () => {
            const analytics = new RedshiftAnalytics("docs.nvidia.com/heavyai");
            expect(analytics["host"]).toBe("docs.nvidia.com");
            expect(analytics["pathPrefix"]).toBe("/heavyai");
        });

        it("parses domain with nested path prefix", () => {
            const analytics = new RedshiftAnalytics("docs.dynamo.nvidia.com/dynamo");
            expect(analytics["host"]).toBe("docs.dynamo.nvidia.com");
            expect(analytics["pathPrefix"]).toBe("/dynamo");
        });
    });

    describe("buildHostFilter", () => {
        it("returns host-only filter when no pathPrefix", () => {
            const analytics = new RedshiftAnalytics("api.docs.spscommerce.com");
            const filter = analytics["buildHostFilter"]('properties."$host"::VARCHAR');
            expect(filter.sql).toBe(`(properties."$host"::VARCHAR = $1 OR properties."$host"::VARCHAR = $2)`);
            expect(filter.params).toEqual(["api.docs.spscommerce.com", "www.api.docs.spscommerce.com"]);
        });

        it("returns host+pathname filter when pathPrefix exists and pathCol provided", () => {
            const analytics = new RedshiftAnalytics("docs.nvidia.com/heavyai");
            const filter = analytics["buildHostFilter"](
                'properties."$host"::VARCHAR',
                'properties."$pathname"::VARCHAR'
            );
            expect(filter.sql).toBe(
                `((properties."$host"::VARCHAR = $1 OR properties."$host"::VARCHAR = $2) AND properties."$pathname"::VARCHAR LIKE $3)`
            );
            expect(filter.params).toEqual(["docs.nvidia.com", "www.docs.nvidia.com", "/heavyai%"]);
        });

        it("returns host-only filter when pathPrefix exists but no pathCol", () => {
            const analytics = new RedshiftAnalytics("docs.nvidia.com/heavyai");
            const filter = analytics["buildHostFilter"]('properties."$host"::VARCHAR');
            expect(filter.sql).toBe(`(properties."$host"::VARCHAR = $1 OR properties."$host"::VARCHAR = $2)`);
            expect(filter.params).toEqual(["docs.nvidia.com", "www.docs.nvidia.com"]);
        });
    });

    describe("get404Pages", () => {
        const dateRange = {
            startDate: new Date("2026-01-01T00:00:00Z"),
            endDate: new Date("2026-01-08T00:00:00Z")
        };

        it("uses pathname-only filter when pathPrefix exists (cross-hostname capture)", async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { path: "/dynamo/archive/missing", count: "5" },
                    { path: "/dynamo/dev/old-page", count: "3" }
                ]
            });

            const analytics = new RedshiftAnalytics("docs.dynamo.nvidia.com/dynamo");
            const result = await analytics.get404Pages({ dateRange, limit: 20 });

            expect(mockQuery).toHaveBeenCalledOnce();
            const [query, params] = mockQuery.mock.calls[0];

            expect(query).toContain(`properties."pathname"::VARCHAR LIKE $1`);
            expect(query).not.toContain(`properties."$host"`);
            expect(params[0]).toBe("/dynamo%");
            expect(params[1]).toBe(dateRange.startDate.toISOString());
            expect(params[2]).toBe(dateRange.endDate.toISOString());
            expect(params[3]).toBe(20);

            expect(result).toEqual([
                { path: "/dynamo/archive/missing", count: 5 },
                { path: "/dynamo/dev/old-page", count: 3 }
            ]);
        });

        it("uses host-only filter when no pathPrefix (simple domain)", async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ path: "/api/missing-endpoint", count: "10" }]
            });

            const analytics = new RedshiftAnalytics("api.docs.spscommerce.com");
            const result = await analytics.get404Pages({ dateRange, limit: 20 });

            expect(mockQuery).toHaveBeenCalledOnce();
            const [query, params] = mockQuery.mock.calls[0];

            expect(query).toContain(`properties."$host"::VARCHAR = $1`);
            expect(query).not.toContain(`properties."pathname"::VARCHAR LIKE`);
            expect(params[0]).toBe("api.docs.spscommerce.com");
            expect(params[1]).toBe("www.api.docs.spscommerce.com");
            expect(params[2]).toBe(dateRange.startDate.toISOString());
            expect(params[3]).toBe(dateRange.endDate.toISOString());
            expect(params[4]).toBe(20);

            expect(result).toEqual([{ path: "/api/missing-endpoint", count: 10 }]);
        });

        it("returns default path and count for null/empty values", async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { path: null, count: null },
                    { path: "", count: "0" }
                ]
            });

            const analytics = new RedshiftAnalytics("example.com");
            const result = await analytics.get404Pages({ dateRange, limit: 20 });

            expect(result).toEqual([
                { path: "/", count: 0 },
                { path: "/", count: 0 }
            ]);
        });
    });

    describe("getTopPages uses host+pathname filter (not pathname-only)", () => {
        it("includes both host and pathname LIKE filter for domain with pathPrefix", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const analytics = new RedshiftAnalytics("docs.nvidia.com/heavyai");
            await analytics.getTopPages({
                dateRange: {
                    startDate: new Date("2026-01-01T00:00:00Z"),
                    endDate: new Date("2026-01-08T00:00:00Z")
                },
                limit: 10
            });

            expect(mockQuery).toHaveBeenCalledOnce();
            const [query, params] = mockQuery.mock.calls[0];
            expect(query).toContain(`properties."$host"::VARCHAR = $1`);
            expect(query).toContain(`properties."$pathname"::VARCHAR LIKE $3`);
            expect(params[0]).toBe("docs.nvidia.com");
            expect(params[2]).toBe("/heavyai%");
        });
    });
});
