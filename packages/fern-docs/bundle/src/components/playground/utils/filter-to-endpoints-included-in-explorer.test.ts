/**
 * @vitest-environment node
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@fern-api/fdr-sdk/api-definition", () => ({
    createEndpointContext: vi.fn()
}));

import type { createCachedDocsLoader } from "@fern-api/docs-loader";
import { createEndpointNode } from "@fern-api/docs-server/utils/create-node";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { ApiDefinitionId, NodeId } from "@fern-api/fdr-sdk/navigation";
import { filterToEndpointsIncludedInExplorer } from "./filter-to-endpoints-included-in-explorer";
import type { ApiGroup } from "./flatten-apis";

type Loader = Awaited<ReturnType<typeof createCachedDocsLoader>>;

describe("filterToEndpointsIncludedInExplorer", () => {
    let mockLoader: Loader;
    const mockCreateEndpointContext = vi.mocked(ApiDefinition.createEndpointContext);

    beforeEach(() => {
        vi.clearAllMocks();
        mockLoader = {
            getPrunedApi: vi.fn().mockResolvedValue({})
        } as unknown as Loader;
    });

    it("filters out endpoints with includeInApiExplorer: false", async () => {
        const endpoint1 = createEndpointNode({ id: NodeId("endpoint-1"), title: "Endpoint 1" });
        const endpoint2 = createEndpointNode({ id: NodeId("endpoint-2"), title: "Endpoint 2" });

        const apiGroups: ApiGroup[] = [
            {
                api: ApiDefinitionId("api-1"),
                id: NodeId("group-1"),
                breadcrumb: ["Group 1"],
                items: [endpoint1, endpoint2]
            }
        ];

        mockCreateEndpointContext.mockImplementation((_node: any, _api: any) => {
            if (_node.id === NodeId("endpoint-1")) {
                return { endpoint: { includeInApiExplorer: false } } as unknown as EndpointContext;
            }
            return { endpoint: { includeInApiExplorer: true } } as unknown as EndpointContext;
        });

        const result = await filterToEndpointsIncludedInExplorer(mockLoader, apiGroups);

        expect(result).toHaveLength(1);
        expect(result[0]?.items).toHaveLength(1);
        expect(result[0]?.items[0]?.id).toBe(NodeId("endpoint-2"));
    });

    it("keeps endpoints with includeInApiExplorer: true", async () => {
        const endpoint1 = createEndpointNode({ id: NodeId("endpoint-1"), title: "Endpoint 1" });
        const endpoint2 = createEndpointNode({ id: NodeId("endpoint-2"), title: "Endpoint 2" });

        const apiGroups: ApiGroup[] = [
            {
                api: ApiDefinitionId("api-1"),
                id: NodeId("group-1"),
                breadcrumb: ["Group 1"],
                items: [endpoint1, endpoint2]
            }
        ];

        mockCreateEndpointContext.mockReturnValue({
            endpoint: { includeInApiExplorer: true }
        } as unknown as EndpointContext);

        const result = await filterToEndpointsIncludedInExplorer(mockLoader, apiGroups);

        expect(result).toHaveLength(1);
        expect(result[0]?.items).toHaveLength(2);
    });

    it("keeps endpoints with includeInApiExplorer: undefined", async () => {
        const endpoint1 = createEndpointNode({ id: NodeId("endpoint-1"), title: "Endpoint 1" });
        const endpoint2 = createEndpointNode({ id: NodeId("endpoint-2"), title: "Endpoint 2" });

        const apiGroups: ApiGroup[] = [
            {
                api: ApiDefinitionId("api-1"),
                id: NodeId("group-1"),
                breadcrumb: ["Group 1"],
                items: [endpoint1, endpoint2]
            }
        ];

        mockCreateEndpointContext.mockReturnValue({
            endpoint: { includeInApiExplorer: undefined }
        } as unknown as EndpointContext);

        const result = await filterToEndpointsIncludedInExplorer(mockLoader, apiGroups);

        expect(result).toHaveLength(1);
        expect(result[0]?.items).toHaveLength(2);
    });

    it("filters out empty groups after filtering endpoints", async () => {
        const endpoint1 = createEndpointNode({ id: NodeId("endpoint-1"), title: "Endpoint 1" });
        const endpoint2 = createEndpointNode({ id: NodeId("endpoint-2"), title: "Endpoint 2" });

        const apiGroups: ApiGroup[] = [
            {
                api: ApiDefinitionId("api-1"),
                id: NodeId("group-1"),
                breadcrumb: ["Group 1"],
                items: [endpoint1]
            },
            {
                api: ApiDefinitionId("api-2"),
                id: NodeId("group-2"),
                breadcrumb: ["Group 2"],
                items: [endpoint2]
            }
        ];

        mockCreateEndpointContext.mockImplementation((_node: any, _api: any) => {
            if (_node.id === NodeId("endpoint-1")) {
                return { endpoint: { includeInApiExplorer: false } } as unknown as EndpointContext;
            }
            return { endpoint: { includeInApiExplorer: true } } as unknown as EndpointContext;
        });

        const result = await filterToEndpointsIncludedInExplorer(mockLoader, apiGroups);

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe(NodeId("group-2"));
    });

    it("caches getPrunedApi calls for the same apiDefinitionId and endpoint id", async () => {
        const endpoint1 = createEndpointNode({ id: NodeId("endpoint-1"), title: "Endpoint 1" });

        const apiGroups: ApiGroup[] = [
            {
                api: ApiDefinitionId("api-1"),
                id: NodeId("group-1"),
                breadcrumb: ["Group 1"],
                items: [endpoint1]
            },
            {
                api: ApiDefinitionId("api-2"),
                id: NodeId("group-2"),
                breadcrumb: ["Group 2"],
                items: [endpoint1]
            }
        ];

        mockCreateEndpointContext.mockReturnValue({
            endpoint: { includeInApiExplorer: true }
        } as unknown as EndpointContext);

        await filterToEndpointsIncludedInExplorer(mockLoader, apiGroups);

        expect(mockLoader.getPrunedApi).toHaveBeenCalledTimes(1);
    });

    it("handles non-endpoint items by keeping them", async () => {
        const endpoint = createEndpointNode({ id: NodeId("endpoint-1"), title: "Endpoint 1" });
        const webhook = {
            type: "webhook" as const,
            id: NodeId("webhook-1"),
            title: "Webhook 1",
            slug: "webhook-1" as any,
            apiDefinitionId: ApiDefinitionId("api-1"),
            isResponseStream: false
        };

        const apiGroups: ApiGroup[] = [
            {
                api: ApiDefinitionId("api-1"),
                id: NodeId("group-1"),
                breadcrumb: ["Group 1"],
                items: [endpoint, webhook as any]
            }
        ];

        mockCreateEndpointContext.mockReturnValue({
            endpoint: { includeInApiExplorer: true }
        } as unknown as EndpointContext);

        const result = await filterToEndpointsIncludedInExplorer(mockLoader, apiGroups);

        expect(result).toHaveLength(1);
        expect(result[0]?.items).toHaveLength(2);
    });

    it("returns empty array when all groups are filtered out", async () => {
        const endpoint1 = createEndpointNode({ id: NodeId("endpoint-1"), title: "Endpoint 1" });

        const apiGroups: ApiGroup[] = [
            {
                api: ApiDefinitionId("api-1"),
                id: NodeId("group-1"),
                breadcrumb: ["Group 1"],
                items: [endpoint1]
            }
        ];

        mockCreateEndpointContext.mockReturnValue({
            endpoint: { includeInApiExplorer: false }
        } as unknown as EndpointContext);

        const result = await filterToEndpointsIncludedInExplorer(mockLoader, apiGroups);

        expect(result).toHaveLength(0);
    });

    it("handles empty apiGroups array", async () => {
        const result = await filterToEndpointsIncludedInExplorer(mockLoader, []);

        expect(result).toHaveLength(0);
        expect(mockLoader.getPrunedApi).not.toHaveBeenCalled();
    });
});
