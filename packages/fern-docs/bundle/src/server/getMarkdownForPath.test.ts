import type { FernNavigation } from "@fern-api/fdr-sdk";
import type { EndpointDefinition, TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { describe, expect, it, vi } from "vitest";
import { getMarkdownForPath } from "./getMarkdownForPath";

/**
 * Creates a minimal mock DocsLoader for testing getMarkdownForPath.
 * Only stubs the methods that getMarkdownForPath actually calls.
 */
function createMockLoader(overrides?: {
    getPage?: DocsLoader["getPage"];
    getFiles?: DocsLoader["getFiles"];
    getTypes?: DocsLoader["getTypes"];
    getPrunedApi?: DocsLoader["getPrunedApi"];
}): DocsLoader {
    return {
        domain: "test.docs.buildwithfern.com",
        fern_token: undefined,
        getPage: overrides?.getPage ?? vi.fn(async () => undefined),
        getFiles: overrides?.getFiles ?? vi.fn(async () => ({})),
        getTypes: overrides?.getTypes ?? vi.fn(async () => ({})),
        getPrunedApi: overrides?.getPrunedApi ?? vi.fn(async () => undefined),
        // Stubs for methods not used by getMarkdownForPath
        getAuthConfig: vi.fn(async () => undefined),
        getMetadata: vi.fn(async () => ({ domain: "test", basePath: "", url: "test", org: "test", isPreview: false })),
        getMdxBundlerFiles: vi.fn(async () => ({})),
        getEndpointById: vi.fn(async () => undefined) as never,
        getEndpointByLocator: vi.fn(async () => undefined) as never,
        getWebhookByLocator: vi.fn(async () => undefined),
        getRoot: vi.fn(async () => ({})) as never,
        getNavigationNode: vi.fn(async () => ({})) as never,
        unsafe_getFullRoot: vi.fn(async () => ({})) as never,
        getConfig: vi.fn(async () => ({})) as never,
        getColors: vi.fn(async () => ({})),
        getLogoUrls: vi.fn(async () => ({})),
        getFonts: vi.fn(async () => ({})) as never,
        getLayout: vi.fn(async () => ({})) as never,
        getSettings: vi.fn(async () => ({})) as never,
        getTheme: vi.fn(async () => ({})) as never,
        getLanguage: vi.fn(async () => "en"),
        getAuthState: vi.fn(async () => ({})) as never,
        getEdgeFlags: vi.fn(async () => ({})) as never,
        getBaseUrl: vi.fn(async () => ""),
        getDynamicIr: vi.fn(async () => undefined),
        isAskAiEnabledForDocs: vi.fn(async () => false),
        getDocsStatus: vi.fn(async () => null)
    } as unknown as DocsLoader;
}

/**
 * Creates a mock page node (non-API leaf) for testing.
 */
function createPageNode(pageId: string, title = "Test Page"): FernNavigation.NavigationNodePage {
    return {
        type: "page",
        id: "node-1" as unknown as never,
        slug: "test/page" as unknown as never,
        title,
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        viewers: undefined,
        orphaned: undefined,
        canonicalSlug: undefined,
        pageId: pageId as unknown as never,
        noindex: undefined
    } as unknown as FernNavigation.NavigationNodePage;
}

/**
 * Creates a mock endpoint node for testing API leaf behavior.
 */
function createEndpointNode(
    endpointId: string,
    apiDefinitionId: string,
    title = "Test Endpoint"
): FernNavigation.NavigationNodePage {
    return {
        type: "endpoint",
        id: "node-ep-1" as unknown as never,
        slug: "api/test-endpoint" as unknown as never,
        title,
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        viewers: undefined,
        orphaned: undefined,
        canonicalSlug: undefined,
        endpointId: endpointId as unknown as never,
        apiDefinitionId: apiDefinitionId as unknown as never,
        isResponseStream: false,
        playground: undefined,
        noindex: undefined,
        method: "GET" as never
    } as unknown as FernNavigation.NavigationNodePage;
}

/**
 * Creates a mock webhook node for testing API leaf behavior.
 */
function createWebhookNode(
    webhookId: string,
    apiDefinitionId: string,
    title = "Test Webhook"
): FernNavigation.NavigationNodePage {
    return {
        type: "webhook",
        id: "node-wh-1" as unknown as never,
        slug: "api/test-webhook" as unknown as never,
        title,
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        viewers: undefined,
        orphaned: undefined,
        canonicalSlug: undefined,
        webhookId: webhookId as unknown as never,
        apiDefinitionId: apiDefinitionId as unknown as never,
        noindex: undefined,
        method: "POST" as never
    } as unknown as FernNavigation.NavigationNodePage;
}

describe("getMarkdownForPath", () => {
    describe("page nodes (non-API leaf)", () => {
        it("should return undefined when page is not found", async () => {
            const node = createPageNode("page.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => undefined) as never
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeUndefined();
        });

        it("should return markdown content for a page node with .mdx extension", async () => {
            const node = createPageNode("my-page.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "my-page.mdx",
                    markdown: "# Hello World\n\nSome content here."
                }))
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.contentType).toBe("mdx");
            expect(result?.content).toContain("Hello World");
            expect(result?.content).toContain("Some content here");
        });

        it("should return markdown contentType for a page node with .md extension", async () => {
            const node = createPageNode("my-page.md");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "my-page.md",
                    markdown: "# Hello World\n\nSome content here."
                }))
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.contentType).toBe("markdown");
            expect(result?.content).toContain("Hello World");
        });

        it("should replace file references with URLs from filesV2", async () => {
            const fileId = "abc123-def456-789012";
            const node = createPageNode("page.mdx");
            const files: Record<string, FileData> = {
                [fileId]: { src: "https://cdn.example.com/image.png" }
            };
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "page.mdx",
                    markdown: `# Page\n\n![image](file:${fileId})`
                })),
                getFiles: vi.fn(async () => files)
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.content).toContain("https://cdn.example.com/image.png");
            expect(result?.content).not.toContain(`file:${fileId}`);
        });

        it("should leave unmatched file references unchanged", async () => {
            const node = createPageNode("page.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "page.mdx",
                    markdown: "# Page\n\n![image](file:unknown-id-here)"
                })),
                getFiles: vi.fn(async () => ({}))
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.content).toContain("file:unknown-id-here");
        });

        it("should use filterMarkdownForLlm when contentMode is 'llm'", async () => {
            const node = createPageNode("page.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "page.mdx",
                    markdown: "# Page\n\n<llms-only>LLM only content</llms-only>\n\n<llms-ignore>Human only content</llms-ignore>"
                }))
            });

            const result = await getMarkdownForPath(node, loader, undefined, [], { contentMode: "llm" });
            expect(result).toBeDefined();
            expect(result?.content).toContain("LLM only content");
            expect(result?.content).not.toContain("Human only content");
        });

        it("should use filterMarkdownForCopyPage by default (contentMode not specified)", async () => {
            const node = createPageNode("page.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "page.mdx",
                    markdown: "# Page\n\n<llms-only>LLM only content</llms-only>\n\n<llms-ignore>Human only content</llms-ignore>"
                }))
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.content).not.toContain("LLM only content");
            expect(result?.content).toContain("Human only content");
        });

        it("should use filterMarkdownForCopyPage when contentMode is 'copy-page'", async () => {
            const node = createPageNode("page.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "page.mdx",
                    markdown: "# Page\n\n<llms-only>LLM only content</llms-only>\n\n<llms-ignore>Human only content</llms-ignore>"
                }))
            });

            const result = await getMarkdownForPath(node, loader, undefined, [], { contentMode: "copy-page" });
            expect(result).toBeDefined();
            expect(result?.content).not.toContain("LLM only content");
            expect(result?.content).toContain("Human only content");
        });

        it("should resolve Schema components when present in page content", async () => {
            const node = createPageNode("page.mdx");
            const userType: TypeDefinition = {
                name: "User",
                description: "A user object",
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "object",
                    extends: [],
                    extraProperties: undefined,
                    properties: [
                        {
                            key: "name" as unknown as never,
                            description: "The user's name",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "string" } },
                            propertyAccess: undefined
                        }
                    ]
                }
            } as unknown as TypeDefinition;
            const types: Record<string, TypeDefinition> = {
                type_0: userType
            };
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "page.mdx",
                    markdown: '# Page\n\n<Schema type="User" />'
                })),
                getTypes: vi.fn(async () => types) as never
            });

            const result = await getMarkdownForPath(node, loader, undefined, [], { contentMode: "llm" });
            expect(result).toBeDefined();
            expect(result?.content).not.toContain("<Schema");
            expect(result?.content).toContain("User");
            expect(result?.content).toContain("name");
        });

        it("should return undefined when pageId is null (section without overviewPageId)", async () => {
            // A section node without an overviewPageId will have getPageId return undefined
            const node = {
                type: "section",
                id: "node-section" as unknown as never,
                slug: "test/section" as unknown as never,
                title: "Test Section",
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                canonicalSlug: undefined,
                overviewPageId: undefined,
                children: [],
                collapsed: undefined,
                noindex: undefined,
                pointsTo: undefined
            } as unknown as FernNavigation.NavigationNodePage;
            const loader = createMockLoader();

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeUndefined();
        });
    });

    describe("API leaf nodes (endpoint)", () => {
        it("should return undefined when API definition is not found", async () => {
            const node = createEndpointNode("ep-1", "api-def-1");
            const loader = createMockLoader({
                getPrunedApi: vi.fn(async () => undefined) as never
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeUndefined();
        });

        it("should return undefined when endpoint is not found in API definition", async () => {
            const node = createEndpointNode("ep-1", "api-def-1");
            const loader = createMockLoader({
                getPrunedApi: vi.fn(async () => ({
                    endpoints: {},
                    webhooks: {},
                    websockets: {},
                    types: {},
                    subpackages: {},
                    auths: [],
                    globalHeaders: []
                })) as never
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeUndefined();
        });

        it("should return endpoint markdown when endpoint is found", async () => {
            const node = createEndpointNode("ep-1", "api-def-1", "Get Users");
            const endpoint: EndpointDefinition = {
                id: "ep-1" as unknown as never,
                method: "GET",
                path: [{ type: "literal", value: "/users" }] as never,
                description: "Retrieves all users",
                environments: [{ id: "env-1" as never, baseUrl: "https://api.example.com" }],
                defaultEnvironment: "env-1" as never,
                requests: undefined,
                responses: undefined,
                errors: undefined,
                examples: undefined,
                availability: undefined,
                protocol: undefined
            } as unknown as EndpointDefinition;
            const loader = createMockLoader({
                getPrunedApi: vi.fn(async () => ({
                    endpoints: { "ep-1": endpoint },
                    webhooks: {},
                    websockets: {},
                    types: {},
                    subpackages: {},
                    auths: [],
                    globalHeaders: []
                })) as never
            });

            const result = await getMarkdownForPath(node, loader, "example.com");
            expect(result).toBeDefined();
            expect(result?.contentType).toBe("mdx");
            expect(result?.content).toContain("# Get Users");
            expect(result?.content).toContain("GET");
            expect(result?.content).toContain("/users");
            expect(result?.content).toContain("Retrieves all users");
        });

        it("should include domain reference URL when domain is provided", async () => {
            const node = createEndpointNode("ep-1", "api-def-1", "Get Users");
            const endpoint: EndpointDefinition = {
                id: "ep-1" as unknown as never,
                method: "GET",
                path: [{ type: "literal", value: "/users" }] as never,
                description: undefined,
                environments: [],
                defaultEnvironment: undefined,
                requests: undefined,
                responses: undefined,
                errors: undefined,
                examples: undefined,
                availability: undefined,
                protocol: undefined
            } as unknown as EndpointDefinition;
            const loader = createMockLoader({
                getPrunedApi: vi.fn(async () => ({
                    endpoints: { "ep-1": endpoint },
                    webhooks: {},
                    websockets: {},
                    types: {},
                    subpackages: {},
                    auths: [],
                    globalHeaders: []
                })) as never
            });

            const result = await getMarkdownForPath(node, loader, "docs.example.com");
            expect(result).toBeDefined();
            expect(result?.content).toContain("Reference: https://docs.example.com");
        });

        it("should not include reference URL when domain is not provided", async () => {
            const node = createEndpointNode("ep-1", "api-def-1", "Get Users");
            const endpoint: EndpointDefinition = {
                id: "ep-1" as unknown as never,
                method: "GET",
                path: [{ type: "literal", value: "/users" }] as never,
                description: undefined,
                environments: [],
                defaultEnvironment: undefined,
                requests: undefined,
                responses: undefined,
                errors: undefined,
                examples: undefined,
                availability: undefined,
                protocol: undefined
            } as unknown as EndpointDefinition;
            const loader = createMockLoader({
                getPrunedApi: vi.fn(async () => ({
                    endpoints: { "ep-1": endpoint },
                    webhooks: {},
                    websockets: {},
                    types: {},
                    subpackages: {},
                    auths: [],
                    globalHeaders: []
                })) as never
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.content).not.toContain("Reference:");
        });
    });

    describe("API leaf nodes (webhook)", () => {
        it("should return undefined when webhook is not found in API definition", async () => {
            const node = createWebhookNode("wh-1", "api-def-1");
            const loader = createMockLoader({
                getPrunedApi: vi.fn(async () => ({
                    endpoints: {},
                    webhooks: {},
                    websockets: {},
                    types: {},
                    subpackages: {},
                    auths: [],
                    globalHeaders: []
                })) as never
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeUndefined();
        });

        it("should return webhook markdown when webhook is found", async () => {
            const node = createWebhookNode("wh-1", "api-def-1", "User Created Webhook");
            const webhook = {
                id: "wh-1",
                method: "POST",
                path: ["/webhooks/user-created"],
                description: "Fired when a user is created",
                headers: [],
                payload: undefined
            };
            const loader = createMockLoader({
                getPrunedApi: vi.fn(async () => ({
                    endpoints: {},
                    webhooks: { "wh-1": webhook },
                    websockets: {},
                    types: {},
                    subpackages: {},
                    auths: [],
                    globalHeaders: []
                })) as never
            });

            const result = await getMarkdownForPath(node, loader, "example.com");
            expect(result).toBeDefined();
            expect(result?.contentType).toBe("mdx");
            expect(result?.content).toContain("# User Created Webhook");
            expect(result?.content).toContain("Fired when a user is created");
        });
    });

    describe("edge cases", () => {
        it("should handle empty markdown content", async () => {
            const node = createPageNode("empty.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "empty.mdx",
                    markdown: ""
                }))
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.content).toBe("");
        });

        it("should handle markdown with only frontmatter", async () => {
            const node = createPageNode("frontmatter.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "frontmatter.mdx",
                    markdown: "---\ntitle: Hello\n---\n"
                }))
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
        });

        it("should pass userRoles through to the filter function", async () => {
            const node = createPageNode("rbac.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "rbac.mdx",
                    markdown: '# Page\n\n<If roles={["admin"]}>Admin content</If>\n\nPublic content'
                }))
            });

            // Without admin role
            const resultNoRole = await getMarkdownForPath(node, loader, undefined, []);
            expect(resultNoRole).toBeDefined();
            expect(resultNoRole?.content).not.toContain("Admin content");
            expect(resultNoRole?.content).toContain("Public content");

            // With admin role
            const resultWithRole = await getMarkdownForPath(node, loader, undefined, ["admin"]);
            expect(resultWithRole).toBeDefined();
            expect(resultWithRole?.content).toContain("Admin content");
            expect(resultWithRole?.content).toContain("Public content");
        });

        it("should handle page content with multiple file references", async () => {
            const fileId1 = "a1b2c3d4-e5f6-0000-1111-aabbccddeeff";
            const fileId2 = "f1e2d3c4-b5a6-0000-2222-112233445566";
            const node = createPageNode("multi-files.mdx");
            const files: Record<string, FileData> = {
                [fileId1]: { src: "https://cdn.example.com/img1.png" },
                [fileId2]: { src: "https://cdn.example.com/img2.jpg" }
            };
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "multi-files.mdx",
                    markdown: `# Page\n\n![img1](file:${fileId1})\n\n![img2](file:${fileId2})`
                })),
                getFiles: vi.fn(async () => files)
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.content).toContain("https://cdn.example.com/img1.png");
            expect(result?.content).toContain("https://cdn.example.com/img2.jpg");
        });

        it("should strip MDX imports and style/script tags in mdx contentMode", async () => {
            const node = createPageNode("complex.mdx");
            const loader = createMockLoader({
                getPage: vi.fn(async () => ({
                    filename: "complex.mdx",
                    markdown: 'import { Component } from "react";\n\n# Hello\n\n<style>{`.foo { color: red; }`}</style>\n\nContent here.'
                }))
            });

            const result = await getMarkdownForPath(node, loader);
            expect(result).toBeDefined();
            expect(result?.content).not.toContain("import");
            expect(result?.content).not.toContain("<style>");
            expect(result?.content).toContain("Hello");
            expect(result?.content).toContain("Content here");
        });
    });
});
