import type * as FernRegistry from "../../../../../index.js";

export type Slug = string & {
    navigation_v1_Slug: void;
};

export function Slug(value: string): Slug {
    return value as unknown as Slug;
}

export type TabId = string & {
    navigation_v1_TabId: void;
};

export function TabId(value: string): TabId {
    return value as unknown as TabId;
}

export type NodeId = string & {
    navigation_v1_NodeId: void;
};

export function NodeId(value: string): NodeId {
    return value as unknown as NodeId;
}

export type ProductId = string & {
    navigation_v1_ProductId: void;
};

export function ProductId(value: string): ProductId {
    return value as unknown as ProductId;
}

export type VariantId = string & {
    navigation_v1_VariantId: void;
};

export function VariantId(value: string): VariantId {
    return value as unknown as VariantId;
}

export const NavigationV1Availability = {
    Stable: "stable",
    GenerallyAvailable: "generally-available",
    InDevelopment: "in-development",
    PreRelease: "pre-release",
    Beta: "beta",
    Deprecated: "deprecated",
} as const;
export type NavigationV1Availability = (typeof NavigationV1Availability)[keyof typeof NavigationV1Availability];

export type RootChild = VersionedNode | UnversionedNode | ProductGroupNode;

export type ProductNode = InternalProductNode | ExternalProductNode;

export type ProductChild = VersionedNode | UnversionedNode;

export type VersionChild = TabbedNode | SidebarRootNode | VariantedNode;

export type VariantChild =
    | ApiReferenceNode
    | SectionNode
    | SidebarGroupNode
    | PageNode
    | LinkNode
    | ChangelogNode;

export type TabChild = TabNode | LinkNode | ChangelogNode;

export type SidebarRootChild = SidebarGroupNode | ApiReferenceNode | SectionNode | VariantedNode;

export type NavigationChild =
    | ApiReferenceNode
    | SectionNode
    | PageNode
    | LinkNode
    | ChangelogNode
    | VariantedNode;

export type ApiPackageChild =
    | ApiPackageNode
    | EndpointNode
    | EndpointPairNode
    | WebSocketNode
    | WebhookNode
    | GrpcNode
    | GraphQlNode
    | PageNode
    | LinkNode;

export interface WithNodeId {
    id: NodeId;
}

export interface WithPermissions {
    viewers: FernRegistry.RoleId[] | undefined;
    orphaned: boolean | undefined;
}

export interface WithNodeMetadata extends WithNodeId, WithPermissions, FernRegistry.navigation.latest.WithFeatureFlags {
    title: string;
    slug: Slug;
    icon: string | undefined;
    hidden: boolean | undefined;
    authed: boolean | undefined;
}

export interface WithPage {
    pageId: FernRegistry.PageId;
    noindex: boolean | undefined;
}

export interface WithOverviewPage {
    overviewPageId: FernRegistry.PageId | undefined;
    noindex: boolean | undefined;
}

export interface WithApiDefinitionId {
    apiDefinitionId: FernRegistry.ApiDefinitionId;
    availability: NavigationV1Availability | undefined;
}

export interface WithRedirect {
    pointsTo: Slug | undefined;
}

export interface PlaygroundButtonSettings {
    href: FernRegistry.Url | undefined;
}

export interface PlaygroundSettings {
    environments: FernRegistry.EnvironmentId[] | undefined;
    button: PlaygroundButtonSettings | undefined;
    "limit-websocket-messages-per-connection": number | undefined;
    hidden: boolean | undefined;
}

export type GraphQlOperationType = "QUERY" | "MUTATION" | "SUBSCRIPTION";

export interface ProductGroupNode extends WithNodeId {
    type: "productgroup";
    landingPage: LandingPageNode | undefined;
    children: ProductNode[];
}

export interface VersionedNode extends WithNodeId {
    type: "versioned";
    children: VersionNode[];
}

export interface UnversionedNode extends WithNodeId {
    type: "unversioned";
    child: VersionChild;
    landingPage: LandingPageNode | undefined;
}

export interface VariantedNode extends WithNodeId {
    type: "varianted";
    children: VariantNode[];
}

export interface TabbedNode extends WithNodeId {
    type: "tabbed";
    children: TabChild[];
}

export interface SidebarRootNode extends WithNodeId {
    type: "sidebarRoot";
    children: SidebarRootChild[];
}

export interface SidebarGroupNode extends WithNodeId {
    type: "sidebarGroup";
    children: NavigationChild[];
}

export interface EndpointPairNode extends WithNodeId {
    type: "endpointPair";
    stream: EndpointNode;
    nonStream: EndpointNode;
}

export interface LinkNode extends WithNodeId {
    type: "link";
    title: string;
    icon: string | undefined;
    url: FernRegistry.Url;
    target: FernRegistry.LinkTarget | undefined;
}

export interface RootNode extends WithNodeMetadata, WithRedirect {
    type: "root";
    version: "v1";
    child: RootChild;
    roles: FernRegistry.RoleId[] | undefined;
}

export interface InternalProductNode extends WithNodeMetadata, WithRedirect {
    type: "product";
    default: boolean;
    productId: ProductId;
    child: ProductChild;
    subtitle: string;
    image: FernRegistry.FileId | undefined;
    announcement: FernRegistry.docs.v1.commons.AnnouncementConfig | undefined;
}

export interface ExternalProductNode extends WithNodeId, WithPermissions {
    type: "productLink";
    default: boolean;
    productId: ProductId;
    title: string;
    href: FernRegistry.Url;
    target: FernRegistry.LinkTarget | undefined;
    subtitle: string;
    icon: string | undefined;
    image: FernRegistry.FileId | undefined;
    hidden: boolean | undefined;
    authed: boolean | undefined;
}

export interface VersionNode extends WithNodeMetadata, WithRedirect {
    type: "version";
    default: boolean;
    versionId: FernRegistry.VersionId;
    child: VersionChild;
    availability: NavigationV1Availability | undefined;
    landingPage: LandingPageNode | undefined;
    announcement: FernRegistry.docs.v1.commons.AnnouncementConfig | undefined;
}

export interface VariantNode extends WithNodeMetadata, WithRedirect {
    type: "variant";
    default: boolean;
    variantId: VariantId;
    subtitle: string | undefined;
    image: FernRegistry.FileId | undefined;
    children: VariantChild[];
}

export interface TabNode extends WithNodeMetadata, WithRedirect {
    type: "tab";
    child: SidebarRootNode;
}

export interface PageNode extends WithNodeMetadata, WithPage {
    type: "page";
    availability: NavigationV1Availability | undefined;
}

export interface LandingPageNode extends WithNodeMetadata, WithPage {
    type: "landingPage";
}

export interface SectionNode extends WithNodeMetadata, WithOverviewPage, WithRedirect {
    type: "section";
    /** @deprecated Use `collapsible` and `collapsedByDefault` instead. */
    collapsed: boolean | undefined;
    collapsible: boolean | undefined;
    collapsedByDefault: boolean | undefined;
    children: NavigationChild[];
    availability: NavigationV1Availability | undefined;
}

export interface ChangelogNode extends WithNodeMetadata, WithOverviewPage {
    type: "changelog";
    children: ChangelogYearNode[];
}

export interface ChangelogYearNode extends WithNodeMetadata {
    type: "changelogYear";
    year: number;
    children: ChangelogMonthNode[];
}

export interface ChangelogMonthNode extends WithNodeMetadata {
    type: "changelogMonth";
    month: number;
    children: ChangelogEntryNode[];
}

export interface ChangelogEntryNode extends WithNodeMetadata, WithPage {
    type: "changelogEntry";
    date: string;
    tags: string[] | undefined;
}

export interface ApiReferenceNode extends WithNodeMetadata, WithOverviewPage, WithApiDefinitionId, WithRedirect {
    type: "apiReference";
    collapsible: boolean | undefined;
    collapsedByDefault: boolean | undefined;
    paginated: boolean | undefined;
    showErrors: boolean | undefined;
    hideTitle: boolean | undefined;
    children: ApiPackageChild[];
    changelog: ChangelogNode | undefined;
    playground: PlaygroundSettings | undefined;
    postmanCollectionUrl: string | undefined;
}

export interface EndpointNode extends WithNodeMetadata, WithApiDefinitionId {
    type: "endpoint";
    method: FernRegistry.HttpMethod;
    endpointId: FernRegistry.EndpointId;
    isResponseStream: boolean | undefined;
    playground: PlaygroundSettings | undefined;
}

export interface WebSocketNode extends WithNodeMetadata, WithApiDefinitionId {
    type: "webSocket";
    webSocketId: FernRegistry.WebSocketId;
    playground: PlaygroundSettings | undefined;
}

export interface WebhookNode extends WithNodeMetadata, WithApiDefinitionId {
    type: "webhook";
    method: FernRegistry.HttpMethod;
    webhookId: FernRegistry.WebhookId;
}

export interface GrpcNode extends WithNodeMetadata, WithApiDefinitionId {
    type: "grpc";
    method: FernRegistry.GrpcMethod;
    grpcId: FernRegistry.GrpcId;
}

export interface GraphQlNode extends WithNodeMetadata, WithApiDefinitionId {
    type: "graphql";
    operationType: GraphQlOperationType;
    graphqlOperationId: FernRegistry.GraphQlOperationId;
    playground: PlaygroundSettings | undefined;
}

export interface ApiPackageNode extends WithNodeMetadata, WithOverviewPage, WithApiDefinitionId, WithRedirect {
    type: "apiPackage";
    collapsible: boolean | undefined;
    collapsedByDefault: boolean | undefined;
    children: ApiPackageChild[];
    playground: PlaygroundSettings | undefined;
}
