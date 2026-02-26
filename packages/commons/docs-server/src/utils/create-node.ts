import { FernNavigation } from "@fern-api/fdr-sdk";
import {
    ApiDefinitionId,
    type ApiReferenceNode,
    EndpointId,
    type EndpointNode,
    type InternalProductNode,
    type NavigationChild,
    NodeId,
    PageId,
    type PageNode,
    type ProductGroupNode,
    ProductId,
    type ProductNode,
    RoleId,
    type RootNode,
    type SectionNode,
    Slug,
    type TabNode,
    type UnversionedNode,
    type VersionedNode,
    type VersionNode
} from "@fern-api/fdr-sdk/navigation";

export function createEndpointNode(node: Partial<EndpointNode>): EndpointNode {
    const title = node.title ?? "title";
    return {
        type: "endpoint",
        title,
        slug: Slug(title.toLowerCase().replace(/\s+/g, "-")),
        apiDefinitionId: ApiDefinitionId("1"),
        availability: undefined,
        canonicalSlug: Slug(title.toLowerCase().replace(/\s+/g, "-")),
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        method: "POST",
        orphaned: undefined,
        viewers: undefined,
        featureFlags: undefined,
        endpointId: EndpointId(node.id ?? "id"),
        isResponseStream: false,
        playground: undefined,
        ...node,
        id: NodeId(node.id ?? "id")
    };
}

export function createApiReferenceNode(node: Partial<ApiReferenceNode>): ApiReferenceNode {
    return {
        type: "apiReference",
        id: NodeId("api-ref"),
        title: "API Reference",
        slug: Slug("api-reference"),
        apiDefinitionId: ApiDefinitionId("1"),
        availability: undefined,
        canonicalSlug: undefined,
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        orphaned: undefined,
        viewers: undefined,
        featureFlags: undefined,
        collapsible: undefined,
        collapsedByDefault: undefined,
        paginated: undefined,
        showErrors: undefined,
        hideTitle: undefined,
        changelog: undefined,
        playground: undefined,
        noindex: undefined,
        overviewPageId: undefined,
        pointsTo: undefined,
        postmanCollectionUrl: undefined,
        children: [],
        ...node
    };
}

export function createVersionNode(versionId: string, children: any): VersionNode {
    return {
        id: NodeId(versionId),
        type: "version",
        title: versionId,
        slug: Slug(versionId),
        versionId: versionId as any, // Type assertion needed due to SDK type mismatch
        default: true,
        availability: undefined,
        landingPage: undefined,
        canonicalSlug: undefined,
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        orphaned: undefined,
        viewers: undefined,
        featureFlags: undefined,
        pointsTo: undefined,
        announcement: undefined,
        child: {
            type: "sidebarRoot",
            id: NodeId("2"),
            children: [createApiReferenceNode({ children })]
        }
    };
}

export function createRootNode(
    children: any,
    childType: "versioned" | "unversioned" | "productgroup" = "unversioned"
): RootNode {
    let rootChild;
    switch (childType) {
        case "versioned":
            rootChild = {
                id: NodeId("1"),
                landingPage: undefined,
                type: "versioned",
                children: [createVersionNode("v1", children)]
            } as VersionedNode;
            break;
        case "unversioned":
            rootChild = {
                id: NodeId("1"),
                landingPage: undefined,
                type: "unversioned",
                child: {
                    type: "sidebarRoot",
                    id: NodeId("2"),
                    children: [createApiReferenceNode({ children })]
                }
            } as UnversionedNode;
            break;
        case "productgroup":
            rootChild = createProductGroupNode("productgroup", children);
            break;
        default:
            throw new Error(`Invalid child type: ${childType}`);
    }

    return {
        type: "root",
        child: rootChild,
        version: "v2",
        title: "Root",
        slug: Slug("root"),
        canonicalSlug: undefined,
        authed: undefined,
        icon: undefined,
        hidden: false,
        id: NodeId("4"),
        viewers: undefined,
        orphaned: undefined,
        pointsTo: undefined,
        roles: [],
        featureFlags: []
    };
}

export function createPageNode(id: string, title = "Should be hidden"): PageNode {
    return {
        type: "page",
        title,
        slug: Slug("hidden"),
        pageId: PageId("1.mdx"),
        canonicalSlug: undefined,
        authed: undefined,
        id: NodeId(id),
        hidden: undefined,
        icon: undefined,
        viewers: [RoleId("everyone")],
        orphaned: undefined,
        noindex: false,
        featureFlags: [],
        availability: undefined
    };
}

export function createSectionNode(id: string, children: NavigationChild[], hidden = true): SectionNode {
    return {
        type: "section",
        id: NodeId(id),
        children,
        title: "Public",
        slug: Slug("public"),
        canonicalSlug: undefined,
        authed: undefined,
        hidden,
        icon: undefined,
        viewers: [RoleId("private")],
        orphaned: undefined,
        noindex: false,
        collapsed: false,
        collapsible: undefined,
        collapsedByDefault: undefined,
        overviewPageId: PageId("1.mdx"),
        pointsTo: undefined,
        featureFlags: [],
        availability: undefined
    };
}

export function createNestedSectionNode(id: string, children: NavigationChild[], hidden = undefined): SectionNode {
    return {
        type: "section",
        id: NodeId(id),
        children,
        title: "Should be hidden",
        slug: Slug("hidden"),
        overviewPageId: PageId("1.mdx"),
        canonicalSlug: undefined,
        authed: undefined,
        hidden,
        icon: undefined,
        viewers: [RoleId("everyone")],
        orphaned: undefined,
        noindex: false,
        collapsed: false,
        collapsible: undefined,
        collapsedByDefault: undefined,
        pointsTo: undefined,
        featureFlags: [],
        availability: undefined
    };
}

export function createProductNode(
    id: string,
    title: string,
    versioned: boolean = false,
    child?: VersionedNode | UnversionedNode
): InternalProductNode {
    const nodeChild =
        child ??
        (versioned
            ? ({
                  type: "versioned",
                  id: NodeId("versioned"),
                  children: [createVersionNode("v1", [])]
              } as VersionedNode)
            : ({
                  type: "unversioned",
                  id: NodeId("unversioned"),
                  child: {
                      type: "tabbed",
                      id: NodeId("tabbed"),
                      children: [createTabNode("tab1", "Tab 1")]
                  },
                  landingPage: undefined
              } as UnversionedNode));
    return {
        type: "product",
        id: NodeId(id),
        title,
        slug: Slug(title.toLowerCase().replace(/\s+/g, "-")),
        productId: ProductId(id),
        default: true,
        canonicalSlug: undefined,
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        orphaned: undefined,
        viewers: undefined,
        featureFlags: [],
        child: nodeChild,
        subtitle: "subtitle",
        image: undefined,
        pointsTo: undefined,
        announcement: undefined
    };
}

export function createProductGroupNode(id: string, children: ProductNode[]): ProductGroupNode {
    return {
        type: "productgroup",
        id: NodeId(id),
        children,
        landingPage: undefined
    };
}

export function createNotFoundNode(): FernNavigation.utils.Node {
    return {
        type: "notFound",
        redirect: undefined,
        authed: undefined
    };
}

export function createFoundNode(
    node: FernNavigation.NavigationNodePage,
    parents: FernNavigation.NavigationNodeParent[],
    root: FernNavigation.RootNode
): FernNavigation.utils.Node.Found {
    const currentProduct = parents.find(FernNavigation.isProductNode);
    const currentVersion = parents.find(FernNavigation.isVersionNode);
    const currentVariant = parents.find(FernNavigation.isVariantNode);

    return {
        type: "found",
        node,
        parents,
        breadcrumb: [], // Mock breadcrumb for testing
        root,
        products: currentProduct ? [currentProduct] : [],
        currentProduct,
        isCurrentProductDefault: false,
        versions: currentVersion ? [currentVersion] : [],
        currentVersion,
        isCurrentVersionDefault: false,
        variants: currentVariant ? [currentVariant] : [],
        currentVariant,
        isCurrentVariantDefault: false,
        currentTab: undefined,
        tabs: [],
        sidebar: undefined,
        apiReference: undefined,
        next: undefined,
        prev: undefined,
        collector: FernNavigation.NodeCollector.collect(root),
        landingPage: undefined,
        unversionedSlug: node.slug // Simplified for testing
    };
}

export function createTabNode(id: string, title: string): TabNode {
    return {
        type: "tab",
        id: NodeId(id),
        title,
        slug: Slug(title.toLowerCase().replace(/\s+/g, "-")),
        canonicalSlug: undefined,
        authed: undefined,
        hidden: undefined,
        icon: undefined,
        viewers: undefined,
        featureFlags: [],
        child: {
            type: "sidebarRoot",
            id: NodeId("sidebarRoot"),
            children: []
        },
        orphaned: undefined,
        pointsTo: undefined
    };
}
