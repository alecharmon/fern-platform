import { createEndpointNode, createRootNode } from "@fern-api/docs-server/utils/create-node";
import { ApiDefinitionId, NodeId, Slug } from "@fern-api/fdr-sdk/navigation";

import { flattenApiSection } from "./flatten-apis";

describe("flattenApi", () => {
    it("empty root returns empty array", () => {
        expect(flattenApiSection(undefined)).toEqual([]);
    });

    it("unversioned api reference with single endpoint flattens", () => {
        const endpoints = [createEndpointNode({ id: NodeId("1"), title: "Endpoint One" })];
        const root = createRootNode(endpoints);
        const result = flattenApiSection(root);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            api: ApiDefinitionId("1"),
            id: NodeId("api-ref"),
            breadcrumb: ["API Reference"],
            items: endpoints
        });
    });

    it("unversioned api reference with multiple endpoints flattens", () => {
        const endpoints = [
            createEndpointNode({ id: NodeId("1"), title: "Endpoint One" }),
            createEndpointNode({ id: NodeId("2"), title: "Endpoint Two" }),
            createEndpointNode({ id: NodeId("3"), title: "Endpoint Three" })
        ];
        const root = createRootNode(endpoints);
        const result = flattenApiSection(root);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            api: ApiDefinitionId("1"),
            id: NodeId("api-ref"),
            breadcrumb: ["API Reference"],
            items: endpoints
        });
    });

    it("versioned api reference with single endpoint flattens", () => {
        const endpoints = [createEndpointNode({ id: NodeId("1"), title: "Endpoint One" })];
        const root = createRootNode(endpoints, "versioned");
        const result = flattenApiSection(root);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            api: ApiDefinitionId("1"),
            id: NodeId("api-ref"),
            breadcrumb: ["API Reference"],
            items: endpoints
        });
    });

    it("versioned api reference with multiple endpoints flattens", () => {
        const endpoints = [
            createEndpointNode({ id: NodeId("1"), title: "Endpoint One" }),
            createEndpointNode({ id: NodeId("2"), title: "Endpoint Two" }),
            createEndpointNode({ id: NodeId("3"), title: "Endpoint Three" })
        ];
        const root = createRootNode(endpoints, "versioned");
        const result = flattenApiSection(root);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            api: ApiDefinitionId("1"),
            id: NodeId("api-ref"),
            breadcrumb: ["API Reference"],
            items: endpoints
        });
    });

    it("versioned api reference with single section flattens", () => {
        const sections = [
            {
                type: "apiPackage",
                id: NodeId("section-1"),
                title: "Section One",
                slug: Slug("section-one"),
                apiDefinitionId: ApiDefinitionId("1"),
                children: [
                    createEndpointNode({ id: NodeId("1"), title: "Endpoint One" }),
                    createEndpointNode({ id: NodeId("2"), title: "Endpoint Two" })
                ]
            }
        ];

        const root = createRootNode(sections, "versioned");
        const result = flattenApiSection(root);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            api: ApiDefinitionId("1"),
            id: NodeId("section-1"),
            breadcrumb: ["Section One"],
            items: sections[0]?.children
        });
    });

    it("versioned api reference with multiple sections flattens", () => {
        const sections = [
            {
                type: "apiPackage",
                id: NodeId("section-1"),
                title: "Section One",
                slug: Slug("section-one"),
                apiDefinitionId: ApiDefinitionId("1"),
                children: [
                    createEndpointNode({ id: NodeId("1"), title: "Endpoint One" }),
                    createEndpointNode({ id: NodeId("2"), title: "Endpoint Two" })
                ]
            },
            {
                type: "apiPackage",
                id: NodeId("section-2"),
                title: "Section Two",
                slug: Slug("section-two"),
                apiDefinitionId: ApiDefinitionId("1"),
                children: [
                    createEndpointNode({ id: NodeId("3"), title: "Endpoint Three" }),
                    createEndpointNode({ id: NodeId("4"), title: "Endpoint Four" })
                ]
            }
        ];

        const root = createRootNode(sections, "versioned");
        const result = flattenApiSection(root);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            api: ApiDefinitionId("1"),
            id: NodeId("section-1"),
            breadcrumb: ["Section One"],
            items: sections[0]?.children
        });
        expect(result[1]).toEqual({
            api: ApiDefinitionId("1"),
            id: NodeId("section-2"),
            breadcrumb: ["Section Two"],
            items: sections[1]?.children
        });
    });
});
