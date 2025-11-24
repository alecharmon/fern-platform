import visitDiscriminatedUnion from "@fern-api/ui-core-utils/visitDiscriminatedUnion";
import { UnreachableCaseError } from "ts-essentials";

import { FernNavigation } from "../..";

/**
 * This migration accounts for the following changes:
 * - add canonicalSlug to all nodes
 * - align availability enum with the rest of FDR
 */
export class FernNavigationV1ToLatest {
    static create(): FernNavigationV1ToLatest {
        return new FernNavigationV1ToLatest();
    }

    private constructor() {}

    // store the base slug
    #baseUrl: string | undefined;

    // this will store the product slug we are currently parsing
    // to be used when setting the canonical URL
    #currentProductSlug: string | undefined;

    // this will store the product slug we are currently parsing
    // to be used when setting the canonical URL
    #currentDefaultVersionSlug: string | undefined;

    public root = (node: FernNavigation.V1.RootNode): FernNavigation.RootNode => {
        this.#baseUrl = FernNavigation.Slug(node.slug);
        const latest: FernNavigation.RootNode = {
            type: "root",
            child: visitDiscriminatedUnion(node.child)._visit<FernNavigation.RootChild>({
                versioned: (value) => this.versioned(value, [node]),
                unversioned: (value) => this.unversioned(value, [node]),
                productgroup: (value) => this.productGroup(value, [node])
            }),
            version: "v2",
            title: node.title,
            id: FernNavigation.NodeId(node.id),
            pointsTo: node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined,
            slug: FernNavigation.Slug(node.slug),
            canonicalSlug: undefined,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            viewers: node.viewers,
            orphaned: node.orphaned,
            roles: node.roles,
            featureFlags: node.featureFlags
        };

        return latest;
    };

    public versioned = (
        node: FernNavigation.V1.VersionedNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.VersionedNode => {
        if (node.children.length === 0) {
            return {
                type: "versioned",
                id: FernNavigation.NodeId(node.id),
                children: []
            };
        }

        let defaultVersionIdx = node.children.findIndex((child) => child.default);
        if (defaultVersionIdx === -1) {
            defaultVersionIdx = 0;
        }

        /**
         * the default version should be the preferred canonical slug
         */
        const defaultVersionV1 = node.children[defaultVersionIdx];
        if (!defaultVersionV1) {
            throw new Error("default version is undefined");
        }

        this.#currentDefaultVersionSlug = FernNavigation.Slug(defaultVersionV1.slug);

        const defaultVersion = this.version(defaultVersionV1, [...parents, node]);

        /**
         * visit the rest of the children, but splice the default version in its original position
         */
        const children = [
            ...node.children.slice(0, defaultVersionIdx).map((child) => this.version(child, [...parents, node])),
            defaultVersion,
            ...node.children.slice(defaultVersionIdx + 1).map((child) => this.version(child, [...parents, node]))
        ];

        const latest: FernNavigation.VersionedNode = {
            type: "versioned",
            id: FernNavigation.NodeId(node.id),
            children
        };

        return latest;
    };

    public version = (
        node: FernNavigation.V1.VersionNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.VersionNode => {
        const landingPage = node.landingPage ? this.landingPage(node.landingPage, [...parents, node]) : undefined;
        const latest: FernNavigation.VersionNode = {
            type: "version",
            default: node.default,
            versionId: node.versionId,
            landingPage,
            child: visitDiscriminatedUnion(node.child)._visit<FernNavigation.VersionChild>({
                tabbed: (value) => this.tabbed(value, [...parents, node]),
                sidebarRoot: (value) => this.sidebarRoot(value, [...parents, node]),
                varianted: (value) => this.varianted(value, [...parents, node])
            }),
            availability: this.#availability(node.availability),
            title: node.title,
            slug: FernNavigation.Slug(node.slug),
            canonicalSlug: undefined,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            id: FernNavigation.NodeId(node.id),
            pointsTo: node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags,
            announcement: node.announcement
        };
        return latest;
    };

    public landingPage = (
        node: FernNavigation.V1.LandingPageNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.LandingPageNode => {
        const slug = FernNavigation.Slug(node.slug);
        const canonicalSlug = this.#getAndSetCanonicalSlug(
            [node.pageId, this.#createTitleDisambiguationKey(node, parents)],
            slug
        );
        const latest: FernNavigation.LandingPageNode = {
            type: "landingPage",
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            id: FernNavigation.NodeId(node.id),
            pageId: FernNavigation.PageId(node.pageId),
            noindex: node.noindex,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public tabbed = (
        node: FernNavigation.V1.TabbedNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.TabbedNode => {
        const latest: FernNavigation.TabbedNode = {
            type: "tabbed",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) =>
                visitDiscriminatedUnion(child)._visit<FernNavigation.TabChild>({
                    tab: (value) => this.tab(value, [...parents, node]),
                    link: (value) => this.link(value, [...parents, node]),
                    changelog: (value) => this.changelog(value, [...parents, node])
                })
            )
        };
        return latest;
    };

    public varianted = (
        node: FernNavigation.V1.VariantedNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.VariantedNode => {
        const latest: FernNavigation.VariantedNode = {
            type: "varianted",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) => this.variant(child, [...parents, node]))
        };
        return latest;
    };

    public variant = (
        node: FernNavigation.V1.VariantNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.VariantNode => {
        const children = node.children.map((child) => this.#variantChild(child, [...parents, node]));

        // If pointsTo is not set, find the first page in the variant's children
        let pointsTo: FernNavigation.Slug | undefined = node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined;
        if (pointsTo == null) {
            pointsTo = this.#findFirstPageSlugInChildren(children);
        }

        const latest: FernNavigation.VariantNode = {
            type: "variant",
            default: node.default,
            variantId: FernNavigation.VariantId(node.variantId),
            subtitle: node.subtitle,
            image: node.image,
            children,
            title: node.title,
            slug: FernNavigation.Slug(node.slug),
            canonicalSlug: undefined,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            id: FernNavigation.NodeId(node.id),
            pointsTo,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public tab = (
        node: FernNavigation.V1.TabNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.TabNode => {
        const latest: FernNavigation.TabNode = {
            type: "tab",
            child: this.sidebarRoot(node.child, [...parents, node]),
            title: node.title,
            slug: FernNavigation.Slug(node.slug),
            canonicalSlug: undefined,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            id: FernNavigation.NodeId(node.id),
            pointsTo: node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public link = (
        node: FernNavigation.V1.LinkNode,
        _parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.LinkNode => {
        const latest: FernNavigation.LinkNode = {
            type: "link",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            url: node.url,
            icon: node.icon,
            target: node.target
        };
        return latest;
    };

    public unversioned = (
        node: FernNavigation.V1.UnversionedNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.UnversionedNode => {
        const latest: FernNavigation.UnversionedNode = {
            type: "unversioned",
            child: visitDiscriminatedUnion(node.child)._visit<FernNavigation.VersionChild>({
                tabbed: (value) => this.tabbed(value, [...parents, node]),
                sidebarRoot: (value) => this.sidebarRoot(value, [...parents, node]),
                varianted: (value) => this.varianted(value, [...parents, node])
            }),
            landingPage: node.landingPage ? this.landingPage(node.landingPage, [...parents, node]) : undefined,
            id: FernNavigation.NodeId(node.id)
        };

        return latest;
    };

    public productGroup = (
        node: FernNavigation.V1.ProductGroupNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ProductGroupNode => {
        const landingPage = node.landingPage ? this.landingPage(node.landingPage, [...parents, node]) : undefined;
        if (node.children.length === 0) {
            return {
                type: "productgroup",
                landingPage,
                id: FernNavigation.NodeId(node.id),
                children: []
            };
        }

        let defaultProductIdx = node.children.findIndex((child) => child.default);

        if (defaultProductIdx === -1) {
            defaultProductIdx = 0;
        }

        /**
         * the default product should be the preferred canonical slug
         */
        const defaultProductV1 = node.children[defaultProductIdx];
        if (!defaultProductV1) {
            throw new Error("default product is undefined");
        }
        const defaultProduct = this.product(defaultProductV1, [...parents, node]);

        /**
         * visit the rest of the children, but splice the default product in its original position
         */
        const children = [
            ...node.children.slice(0, defaultProductIdx).map((child) => this.product(child, [...parents, node])),
            defaultProduct,
            ...node.children.slice(defaultProductIdx + 1).map((child) => this.product(child, [...parents, node]))
        ];

        const latest: FernNavigation.ProductGroupNode = {
            type: "productgroup",
            landingPage,
            children,
            id: FernNavigation.NodeId(node.id)
        };
        return latest;
    };

    public product = (
        node: FernNavigation.V1.ProductNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ProductNode => {
        return visitDiscriminatedUnion(node)._visit<FernNavigation.ProductNode>({
            product: (internalNode) => this.internalProduct(internalNode, parents),
            productLink: (externalNode) => this.externalProduct(externalNode)
        });
    };

    public internalProduct = (
        node: FernNavigation.V1.InternalProductNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.InternalProductNode => {
        this.#currentProductSlug = node.slug;
        const latest: FernNavigation.InternalProductNode = {
            type: "product",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            slug: FernNavigation.Slug(node.slug),
            canonicalSlug: undefined,
            icon: node.icon,
            image: node.image,
            hidden: node.hidden,
            authed: node.authed,
            pointsTo: node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined,
            default: node.default,
            productId: FernNavigation.ProductId(node.productId),
            child: visitDiscriminatedUnion(node.child)._visit<FernNavigation.ProductChild>({
                unversioned: (value) => this.unversioned(value, [...parents, node]),
                versioned: (value) => this.versioned(value, [...parents, node])
            }),
            subtitle: node.subtitle,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags,
            announcement: node.announcement
        };
        return latest;
    };

    public externalProduct = (node: FernNavigation.V1.ExternalProductNode): FernNavigation.ExternalProductNode => {
        const latest: FernNavigation.ExternalProductNode = {
            type: "productLink",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            href: node.href,
            target: node.target,
            default: node.default,
            productId: FernNavigation.ProductId(node.productId),
            subtitle: node.subtitle,
            icon: node.icon,
            image: node.image,
            hidden: node.hidden,
            authed: node.authed,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: undefined
        };
        return latest;
    };

    public sidebarRoot = (
        node: FernNavigation.V1.SidebarRootNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.SidebarRootNode => {
        const latest: FernNavigation.SidebarRootNode = {
            type: "sidebarRoot",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) =>
                visitDiscriminatedUnion(child)._visit<FernNavigation.SidebarRootChild>({
                    sidebarGroup: (value) => this.sidebarGroup(value, [...parents, node]),
                    apiReference: (value) => this.apiReference(value, [...parents, node]),
                    section: (value) => this.section(value, [...parents, node]),
                    varianted: (value) => this.varianted(value, [...parents, node])
                })
            )
        };
        return latest;
    };

    public sidebarGroup = (
        node: FernNavigation.V1.SidebarGroupNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.SidebarGroupNode => {
        const latest: FernNavigation.SidebarGroupNode = {
            type: "sidebarGroup",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) => this.#navigationChild(child, [...parents, node]))
        };
        return latest;
    };

    public page = (
        node: FernNavigation.V1.PageNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.PageNode => {
        const slug = FernNavigation.Slug(node.slug);
        const canonicalSlug = this.#getAndSetCanonicalSlug(
            [node.pageId, this.#createTitleDisambiguationKey(node, parents)],
            slug
        );
        const latest: FernNavigation.PageNode = {
            type: "page",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            pageId: FernNavigation.PageId(node.pageId),
            noindex: node.noindex,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags,
            availability: this.#availability(node.availability)
        };
        return latest;
    };

    public section = (
        node: FernNavigation.V1.SectionNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.SectionNode => {
        const slug = FernNavigation.Slug(node.slug);
        const overviewPageId = node.overviewPageId ? FernNavigation.PageId(node.overviewPageId) : undefined;
        const canonicalSlug =
            overviewPageId != null
                ? this.#getAndSetCanonicalSlug(
                      [overviewPageId, this.#createTitleDisambiguationKey(node, parents)],
                      slug
                  )
                : undefined;
        const latest: FernNavigation.SectionNode = {
            type: "section",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) => this.#navigationChild(child, [...parents, node])),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            pointsTo: node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined,
            collapsed: node.collapsed,
            overviewPageId,
            noindex: node.noindex,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags,
            availability: this.#availability(node.availability)
        };
        return latest;
    };

    public apiReference = (
        node: FernNavigation.V1.ApiReferenceNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ApiReferenceNode => {
        const slug = FernNavigation.Slug(node.slug);
        const overviewPageId = node.overviewPageId ? FernNavigation.PageId(node.overviewPageId) : undefined;
        const canonicalSlug =
            overviewPageId != null
                ? this.#getAndSetCanonicalSlug(
                      [overviewPageId, this.#createTitleDisambiguationKey(node, parents)],
                      slug
                  )
                : undefined;
        const latest: FernNavigation.ApiReferenceNode = {
            type: "apiReference",
            paginated: node.paginated,
            showErrors: node.showErrors,
            hideTitle: node.hideTitle,
            children: node.children.map((child) => this.#apiPackageChild(child, [...parents, node])),
            changelog: node.changelog ? this.changelog(node.changelog, [...parents, node]) : undefined,
            playground: node.playground,
            postmanCollectionUrl: node.postmanCollectionUrl,
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            id: FernNavigation.NodeId(node.id),
            overviewPageId,
            noindex: node.noindex,
            apiDefinitionId: node.apiDefinitionId,
            availability: this.#availability(node.availability),
            pointsTo: node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public changelog = (
        node: FernNavigation.V1.ChangelogNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ChangelogNode => {
        const slug = FernNavigation.Slug(node.slug);
        const overviewPageId = node.overviewPageId ? FernNavigation.PageId(node.overviewPageId) : undefined;
        const canonicalSlug = overviewPageId != null ? this.#getAndSetCanonicalSlug(overviewPageId, slug) : undefined;
        const latest: FernNavigation.ChangelogNode = {
            type: "changelog",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) => this.changelogYear(child, [...parents, node])),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            overviewPageId,
            noindex: node.noindex,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public changelogYear = (
        node: FernNavigation.V1.ChangelogYearNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ChangelogYearNode => {
        const latest: FernNavigation.ChangelogYearNode = {
            type: "changelogYear",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) => this.changelogMonth(child, [...parents, node])),
            title: node.title,
            slug: FernNavigation.Slug(node.slug),
            canonicalSlug: undefined,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            year: node.year,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public changelogMonth = (
        node: FernNavigation.V1.ChangelogMonthNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ChangelogMonthNode => {
        const latest: FernNavigation.ChangelogMonthNode = {
            type: "changelogMonth",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) => this.changelogEntry(child, [...parents, node])),
            title: node.title,
            slug: FernNavigation.Slug(node.slug),
            canonicalSlug: undefined,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            month: node.month,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public changelogEntry = (
        node: FernNavigation.V1.ChangelogEntryNode,
        _parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ChangelogEntryNode => {
        const slug = FernNavigation.Slug(node.slug);
        // NOTE: do NOT use title disambiguation key here, since the title may not always be unique
        const canonicalSlug = this.#getAndSetCanonicalSlug(node.pageId, slug);
        const latest: FernNavigation.ChangelogEntryNode = {
            type: "changelogEntry",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            date: node.date,
            pageId: FernNavigation.PageId(node.pageId),
            noindex: node.noindex,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags,
            tags: node.tags
        };
        return latest;
    };

    public apiPackage = (
        node: FernNavigation.V1.ApiPackageNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ApiPackageNode => {
        const slug = FernNavigation.Slug(node.slug);
        const overviewPageId = node.overviewPageId ? FernNavigation.PageId(node.overviewPageId) : undefined;
        const canonicalSlug =
            overviewPageId != null
                ? this.#getAndSetCanonicalSlug(
                      [overviewPageId, this.#createTitleDisambiguationKey(node, parents)],
                      slug
                  )
                : undefined;
        const latest: FernNavigation.ApiPackageNode = {
            type: "apiPackage",
            id: FernNavigation.NodeId(node.id),
            children: node.children.map((child) => this.#apiPackageChild(child, [...parents, node])),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            pointsTo: node.pointsTo ? FernNavigation.Slug(node.pointsTo) : undefined,
            playground: node.playground,
            overviewPageId,
            noindex: node.noindex,
            apiDefinitionId: node.apiDefinitionId,
            availability: this.#availability(node.availability),
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public endpoint = (
        node: FernNavigation.V1.EndpointNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.EndpointNode => {
        const apiDisambiguation = this.#createApiDisambiguationKey(parents);
        const slug = FernNavigation.Slug(node.slug);
        const canonicalSlug = this.#getAndSetCanonicalSlug(
            [
                `${apiDisambiguation}:api:endpoint:${node.method}:${node.endpointId}`,
                this.#createTitleDisambiguationKey(node, parents)
            ],
            slug
        );
        const latest: FernNavigation.EndpointNode = {
            type: "endpoint",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            playground: node.playground,
            apiDefinitionId: node.apiDefinitionId,
            availability: this.#availability(node.availability),
            method: node.method,
            endpointId: node.endpointId,
            isResponseStream: node.isResponseStream,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public endpointPair = (
        node: FernNavigation.V1.EndpointPairNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.EndpointPairNode => {
        const latest: FernNavigation.EndpointPairNode = {
            type: "endpointPair",
            id: FernNavigation.NodeId(node.id),
            nonStream: this.endpoint(node.nonStream, [...parents, node]),
            stream: this.endpoint(node.stream, [...parents, node])
        };
        return latest;
    };

    public webSocket = (
        node: FernNavigation.V1.WebSocketNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.WebSocketNode => {
        const apiDisambiguation = this.#createApiDisambiguationKey(parents);
        const slug = FernNavigation.Slug(node.slug);
        const canonicalSlug = this.#getAndSetCanonicalSlug(
            [
                `${apiDisambiguation}:api:websocket:${node.webSocketId}`,
                this.#createTitleDisambiguationKey(node, parents)
            ],
            slug
        );
        const latest: FernNavigation.WebSocketNode = {
            type: "webSocket",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            playground: node.playground,
            apiDefinitionId: node.apiDefinitionId,
            availability: this.#availability(node.availability),
            webSocketId: node.webSocketId,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public webhook = (
        node: FernNavigation.V1.WebhookNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.WebhookNode => {
        const apiDisambiguation = this.#createApiDisambiguationKey(parents);
        const slug = FernNavigation.Slug(node.slug);
        const canonicalSlug = this.#getAndSetCanonicalSlug(
            [
                `${apiDisambiguation}:api:webhook:${node.method}:${node.webhookId}`,
                this.#createTitleDisambiguationKey(node, parents)
            ],
            slug
        );
        const latest: FernNavigation.WebhookNode = {
            type: "webhook",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            apiDefinitionId: node.apiDefinitionId,
            availability: this.#availability(node.availability),
            method: node.method,
            webhookId: node.webhookId,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    public grpc = (
        node: FernNavigation.V1.GrpcNode,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.GrpcNode => {
        const apiDisambiguation = this.#createApiDisambiguationKey(parents);
        const slug = FernNavigation.Slug(node.slug);
        const canonicalSlug = this.#getAndSetCanonicalSlug(
            [
                `${apiDisambiguation}:api:grpc:${node.method}:${node.grpcId}`,
                this.#createTitleDisambiguationKey(node, parents)
            ],
            slug
        );
        const latest: FernNavigation.GrpcNode = {
            type: "grpc",
            id: FernNavigation.NodeId(node.id),
            title: node.title,
            slug,
            canonicalSlug,
            icon: node.icon,
            hidden: node.hidden,
            authed: node.authed,
            apiDefinitionId: node.apiDefinitionId,
            availability: this.#availability(node.availability),
            method: node.method,
            grpcId: node.grpcId,
            viewers: node.viewers,
            orphaned: node.orphaned,
            featureFlags: node.featureFlags
        };
        return latest;
    };

    #variantChild = (
        child: FernNavigation.V1.VariantChild,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.VariantChild => {
        return visitDiscriminatedUnion(child)._visit<FernNavigation.VariantChild>({
            apiReference: (value) => this.apiReference(value, parents),
            section: (value) => this.section(value, parents),
            sidebarGroup: (value) => this.sidebarGroup(value, parents),
            link: (value) => this.link(value, parents),
            page: (value) => this.page(value, parents),
            changelog: (value) => this.changelog(value, parents)
        });
    };

    #navigationChild = (
        child: FernNavigation.V1.NavigationChild,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.NavigationChild => {
        return visitDiscriminatedUnion(child)._visit<FernNavigation.NavigationChild>({
            apiReference: (value) => this.apiReference(value, parents),
            section: (value) => this.section(value, parents),
            link: (value) => this.link(value, parents),
            page: (value) => this.page(value, parents),
            changelog: (value) => this.changelog(value, parents),
            varianted: (value) => this.varianted(value, parents)
        });
    };

    #apiPackageChild = (
        child: FernNavigation.V1.ApiPackageChild,
        parents: FernNavigation.V1.NavigationNode[]
    ): FernNavigation.ApiPackageChild => {
        return visitDiscriminatedUnion(child)._visit<FernNavigation.ApiPackageChild>({
            page: (value) => this.page(value, parents),
            link: (value) => this.link(value, parents),
            apiPackage: (value) => this.apiPackage(value, parents),
            endpoint: (value) => this.endpoint(value, parents),
            endpointPair: (value) => this.endpointPair(value, parents),
            webSocket: (value) => this.webSocket(value, parents),
            webhook: (value) => this.webhook(value, parents),
            grpc: (value) => this.grpc(value, parents)
        });
    };

    /**
     * Recursively searches for the first page node within a list of children
     */
    #findFirstPageSlugInChildren = (
        children: readonly FernNavigation.NavigationNode[]
    ): FernNavigation.Slug | undefined => {
        for (const child of children) {
            if (FernNavigation.isPage(child)) {
                return child.slug;
            }

            const childChildren = FernNavigation.getChildren(child);
            if (childChildren != null && childChildren.length > 0) {
                const firstPage = this.#findFirstPageSlugInChildren(childChildren);
                if (firstPage != null) {
                    return firstPage;
                }
            }
        }
        return undefined;
    };

    #availability(v1: FernNavigation.V1.NavigationV1Availability | undefined): FernNavigation.Availability | undefined {
        if (v1 == null) {
            return undefined;
        }
        switch (v1) {
            case "beta":
                return FernNavigation.Availability.Beta;
            case "deprecated":
                return FernNavigation.Availability.Deprecated;
            case "generally-available":
                return FernNavigation.Availability.GenerallyAvailable;
            case "in-development":
                return FernNavigation.Availability.InDevelopment;
            case "pre-release":
                return FernNavigation.Availability.PreRelease;
            case "stable":
                return FernNavigation.Availability.Stable;
            default:
                throw new UnreachableCaseError(v1);
        }
    }

    #canonicalSlugs = new Map<string, FernNavigation.Slug>();

    // return a match found with any key
    #getCanonicalSlug = (keyOrKeys: string | string[]) => {
        if (typeof keyOrKeys === "string") {
            return this.#canonicalSlugs.get(keyOrKeys);
        }

        for (const key of keyOrKeys) {
            const existing = this.#canonicalSlugs.get(key);

            // explicitly check for undefined because empty string is valid
            if (existing !== undefined) {
                return existing;
            }
        }

        return undefined;
    };

    // set all keys to use the same canonical url
    #setCanonicalSlug = (keyOrKeys: string | string[], fullCanonical: FernNavigation.Slug) => {
        const baseSlug = this.#currentProductSlug ?? "" + this.#baseUrl;

        // if the canonical slug includes the default version, prefer an unversioned slug
        const normalizedCanonical = this.#currentDefaultVersionSlug
            ? fullCanonical.replace(new RegExp(`(^|/)${this.#currentDefaultVersionSlug}(/|$)`, "g"), `$1${baseSlug}$2`)
            : fullCanonical;

        // canonical slug should always begin without a slash
        const canonicalSlug = FernNavigation.Slug(normalizedCanonical.replace(/^\//, ""));

        if (typeof keyOrKeys === "string") {
            this.#canonicalSlugs.set(keyOrKeys, canonicalSlug);
            return canonicalSlug;
        }

        // canonical slug should apply to all keys of a given page
        for (const key of keyOrKeys) {
            this.#canonicalSlugs.set(key, canonicalSlug);
        }

        return canonicalSlug;
    };

    // TODO: canonical url logic should account for RBAC, since we should always prefer the publicly available url over the private one (for SEO)
    #getAndSetCanonicalSlug = (
        keyOrKeys: string | string[],
        slug: FernNavigation.Slug
    ): FernNavigation.Slug | undefined => {
        if (keyOrKeys == null) {
            return undefined;
        }

        const existing = this.#getCanonicalSlug(keyOrKeys);
        if (existing != null) {
            return existing;
        }

        const canonicalSlug = this.#setCanonicalSlug(keyOrKeys, slug);
        return canonicalSlug;
    };

    #createTitleDisambiguationKey = (
        node: FernNavigation.V1.NavigationNodeWithMetadata,
        parents: FernNavigation.V1.NavigationNode[]
    ): string => {
        const unversionedParents = this.#findUnversionedParents(parents);
        const unversionedParentTitles = unversionedParents
            .filter(FernNavigation.V1.hasMetadata)
            .map((parent) => parent.title);
        return [...unversionedParentTitles, node.title].join("###");
    };

    #createApiDisambiguationKey = (parents: FernNavigation.V1.NavigationNode[]): string => {
        const unversionedParents = this.#findUnversionedParents(parents);
        const unversionedParentIds = unversionedParents
            .filter((parent) => parent.type === "apiReference")
            .map((parent) => parent.title.replaceAll(" ", ""));
        return [...unversionedParentIds].join(":");
    };

    #findUnversionedParents = (parents: FernNavigation.V1.NavigationNode[]): FernNavigation.V1.NavigationNode[] => {
        const versionIdx = parents.findIndex((parent) => parent.type === "version");
        const unversionedParents = versionIdx >= 0 ? parents.slice(versionIdx + 1) : parents;
        return unversionedParents;
    };
}
