import * as z from "zod";
import type { RootNode } from "../../navigation/types/v1.js";
import type {
    EndpointId as EndpointId_,
    PageId,
    SubpackageId,
    WebhookId as WebhookId_,
    WebSocketId as WebSocketId_
} from "./write-commons";
import {
    AIChatConfigSchema,
    AnalyticsConfigSchema,
    ApiDefinitionIdSchema,
    AvailabilitySchema,
    ColorsConfigSchema,
    ColorsConfigV2Schema,
    CssConfigSchema,
    DocsLayoutConfigSchema,
    DocsSettingsConfigSchema,
    DocsThemeConfigSchema,
    DocsTypographyConfigSchema,
    DocsTypographyConfigV2Schema,
    EditThisPageLaunchSchema,
    EndpointIdSchema,
    FileIdSchema,
    FooterLinkSchema,
    IntegrationsConfigSchema,
    JsConfigSchema,
    LanguageSchema,
    LinkTargetSchema,
    MetadataConfigSchema,
    NavbarLinkSchema,
    PageActionsConfigSchema,
    PageIdSchema,
    ProgrammingLanguageSchema,
    RedirectConfigSchema,
    RgbaColorSchema,
    SubpackageIdSchema,
    ThemedFileIdSchema,
    UrlSchema,
    VersionIdSchema,
    WebhookIdSchema,
    WebSocketIdSchema
} from "./write-commons";

export type FilePath = string & { docs_v1_write_FilePath: void };
export const FilePathSchema: z.ZodType<FilePath> = z.string() as any;
export function FilePath(value: string): FilePath {
    return value as unknown as FilePath;
}

export type DocsRegistrationId = string & { docs_v1_write_DocsRegistrationId: void };
export const DocsRegistrationIdSchema: z.ZodType<DocsRegistrationId> = z.string() as any;
export function DocsRegistrationId(value: string): DocsRegistrationId {
    return value as unknown as DocsRegistrationId;
}

export const HeightSchema = z.number();
export type Height = z.infer<typeof HeightSchema>;

export const FileS3UploadUrlSchema = z.object({
    uploadUrl: z.string(),
    fileId: FileIdSchema
});
export type FileS3UploadUrl = z.infer<typeof FileS3UploadUrlSchema>;

export const StartDocsRegisterResponseSchema = z.object({
    docsRegistrationId: DocsRegistrationIdSchema,
    uploadUrls: z.record(FilePathSchema, FileS3UploadUrlSchema),
    skippedFiles: z.array(FilePathSchema)
});
export type StartDocsRegisterResponse = z.infer<typeof StartDocsRegisterResponseSchema>;

export const PageContentSchema = z.object({
    markdown: z.string(),
    editThisPageUrl: UrlSchema.optional(),
    editThisPageLaunch: EditThisPageLaunchSchema.optional(),
    rawMarkdown: z.string().optional()
});
export type PageContent = z.infer<typeof PageContentSchema>;

export const NavigationNodeMetadataSchema = z.object({
    icon: z.string().optional(),
    hidden: z.boolean().optional(),
    urlSlugOverride: z.string().optional(),
    fullSlug: z.array(z.string()).optional()
});
export type NavigationNodeMetadata = z.infer<typeof NavigationNodeMetadataSchema>;

export const PageMetadataSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    id: PageIdSchema,
    title: z.string()
});
export type PageMetadata = z.infer<typeof PageMetadataSchema>;

export const LinkMetadataSchema = z.object({
    title: z.string(),
    icon: z.string().optional(),
    url: UrlSchema,
    target: LinkTargetSchema.optional()
});
export type LinkMetadata = z.infer<typeof LinkMetadataSchema>;

export const ChangelogItemSchema = z.object({
    date: z.string(),
    pageId: PageIdSchema,
    hidden: z.boolean().optional(),
    tags: z.array(z.string()).optional()
});
export type ChangelogItem = z.infer<typeof ChangelogItemSchema>;

export const ChangelogSectionSchema = z.object({
    title: z.string().optional(),
    icon: z.string().optional(),
    hidden: z.boolean().optional(),
    description: z.string().optional(),
    pageId: PageIdSchema.optional(),
    items: z.array(ChangelogItemSchema),
    urlSlug: z.string(),
    fullSlug: z.array(z.string()).optional()
});
export type ChangelogSection = z.infer<typeof ChangelogSectionSchema>;

export const ChangelogSectionV2Schema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string().optional(),
    description: z.string().optional(),
    pageId: PageIdSchema.optional(),
    items: z.array(ChangelogItemSchema)
});
export type ChangelogSectionV2 = z.infer<typeof ChangelogSectionV2Schema>;

export const ChangelogSectionV3Schema = z.object({
    node: z.unknown()
});
export type ChangelogSectionV3 = z.infer<typeof ChangelogSectionV3Schema>;

export const NavigationTabLinkSchema = z.object({
    title: z.string(),
    icon: z.string().optional(),
    url: UrlSchema,
    target: LinkTargetSchema.optional()
});
export type NavigationTabLink = z.infer<typeof NavigationTabLinkSchema>;

export type ApiNavigationConfigItem =
    | ApiNavigationConfigItem.Subpackage
    | ApiNavigationConfigItem.EndpointId
    | ApiNavigationConfigItem.WebsocketId
    | ApiNavigationConfigItem.WebhookId
    | ApiNavigationConfigItem.Page;

export namespace ApiNavigationConfigItem {
    export interface Subpackage {
        type: "subpackage";
        summaryPageId?: PageId | null;
        subpackageId: SubpackageId;
        items: ApiNavigationConfigItem[];
    }
    export interface EndpointId {
        type: "endpointId";
        value: EndpointId_;
    }
    export interface WebsocketId {
        type: "websocketId";
        value: WebSocketId_;
    }
    export interface WebhookId {
        type: "webhookId";
        value: WebhookId_;
    }
    export interface Page extends PageMetadata {
        type: "page";
    }
}

export const ApiNavigationConfigItemSchema: z.ZodType<ApiNavigationConfigItem> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("subpackage"),
            summaryPageId: PageIdSchema.optional(),
            subpackageId: SubpackageIdSchema,
            items: z.array(ApiNavigationConfigItemSchema)
        }),
        z.object({ type: z.literal("endpointId"), value: EndpointIdSchema }),
        z.object({ type: z.literal("websocketId"), value: WebSocketIdSchema }),
        z.object({ type: z.literal("webhookId"), value: WebhookIdSchema }),
        z.object({ type: z.literal("page"), ...PageMetadataSchema.shape })
    ])
);

export const ApiNavigationConfigSubpackageSchema = z.object({
    summaryPageId: PageIdSchema.optional(),
    subpackageId: SubpackageIdSchema,
    items: z.array(ApiNavigationConfigItemSchema)
});
export type ApiNavigationConfigSubpackage = z.infer<typeof ApiNavigationConfigSubpackageSchema>;

export const ApiNavigationConfigRootSchema = z.object({
    summaryPageId: PageIdSchema.optional(),
    items: z.array(ApiNavigationConfigItemSchema)
});
export type ApiNavigationConfigRoot = z.infer<typeof ApiNavigationConfigRootSchema>;

export const ApiSectionSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string(),
    api: ApiDefinitionIdSchema,
    artifacts: z
        .object({
            sdks: z.array(
                z.discriminatedUnion("type", [
                    z.object({
                        type: z.literal("npm"),
                        packageName: z.string(),
                        githubRepoName: z.string(),
                        version: z.string()
                    }),
                    z.object({
                        type: z.literal("maven"),
                        coordinate: z.string(),
                        githubRepoName: z.string(),
                        version: z.string()
                    }),
                    z.object({
                        type: z.literal("pypi"),
                        packageName: z.string(),
                        githubRepoName: z.string(),
                        version: z.string()
                    })
                ])
            ),
            postman: z
                .object({
                    url: UrlSchema,
                    githubRepoName: z.string().optional()
                })
                .optional()
        })
        .optional(),
    skipUrlSlug: z.boolean().optional(),
    showErrors: z.boolean().optional(),
    changelog: ChangelogSectionSchema.optional(),
    changelogV2: ChangelogSectionV2Schema.optional(),
    navigation: ApiNavigationConfigRootSchema.optional(),
    longScrolling: z.boolean().optional(),
    flattened: z.boolean().optional()
});
export type ApiSection = z.infer<typeof ApiSectionSchema>;

export const ApiSectionV2Schema = z.object({
    node: z.unknown()
});
export type ApiSectionV2 = z.infer<typeof ApiSectionV2Schema>;

export type NavigationItem =
    | NavigationItem.Page
    | NavigationItem.Api
    | NavigationItem.ApiV2
    | NavigationItem.Section
    | NavigationItem.Link
    | NavigationItem.Changelog
    | NavigationItem.ChangelogV3;

export namespace NavigationItem {
    export interface Page extends PageMetadata {
        type: "page";
    }
    export interface Api extends ApiSection {
        type: "api";
    }
    export interface ApiV2 extends ApiSectionV2 {
        type: "apiV2";
    }
    export interface Section extends DocsSection {
        type: "section";
    }
    export interface Link extends LinkMetadata {
        type: "link";
    }
    export interface Changelog extends ChangelogSectionV2 {
        type: "changelog";
    }
    export interface ChangelogV3 extends ChangelogSectionV3 {
        type: "changelogV3";
    }
}

export type DocsSection = NavigationNodeMetadata & {
    title: string;
    items: NavigationItem[];
    /** @deprecated Use `collapsible` and `collapsedByDefault` instead. */
    collapsed?: boolean | "open-by-default";
    collapsible?: boolean;
    collapsedByDefault?: boolean;
    skipUrlSlug?: boolean;
    overviewPageId?: PageId;
};

export const DocsSectionSchema: z.ZodType<DocsSection> = z.lazy(() =>
    z.object({
        ...NavigationNodeMetadataSchema.shape,
        title: z.string(),
        items: z.array(NavigationItemSchema),
        collapsed: z.union([z.boolean(), z.literal("open-by-default")]).optional(),
        collapsible: z.boolean().optional(),
        collapsedByDefault: z.boolean().optional(),
        skipUrlSlug: z.boolean().optional(),
        overviewPageId: PageIdSchema.optional()
    })
);

export const NavigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({ type: z.literal("page"), ...PageMetadataSchema.shape }),
        z.object({ type: z.literal("api"), ...ApiSectionSchema.shape }),
        z.object({ type: z.literal("apiV2"), ...ApiSectionV2Schema.shape }),
        z.object({
            type: z.literal("section"),
            ...NavigationNodeMetadataSchema.shape,
            title: z.string(),
            items: z.array(NavigationItemSchema),
            collapsed: z.union([z.boolean(), z.literal("open-by-default")]).optional(),
            collapsible: z.boolean().optional(),
            collapsedByDefault: z.boolean().optional(),
            skipUrlSlug: z.boolean().optional(),
            overviewPageId: PageIdSchema.optional()
        }),
        z.object({ type: z.literal("link"), ...LinkMetadataSchema.shape }),
        z.object({ type: z.literal("changelog"), ...ChangelogSectionV2Schema.shape }),
        z.object({ type: z.literal("changelogV3"), ...ChangelogSectionV3Schema.shape })
    ])
);

export const NavigationTabGroupSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string(),
    items: z.array(NavigationItemSchema),
    skipUrlSlug: z.boolean().optional()
});
export type NavigationTabGroup = z.infer<typeof NavigationTabGroupSchema>;

export const NavigationTabSchema = z.union([NavigationTabGroupSchema, NavigationTabLinkSchema]);
export type NavigationTab = z.infer<typeof NavigationTabSchema>;

export const NavigationTabV2Schema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("group"), ...NavigationTabGroupSchema.shape }),
    z.object({ type: z.literal("link"), ...NavigationTabLinkSchema.shape }),
    z.object({ type: z.literal("changelog"), ...ChangelogSectionV2Schema.shape }),
    z.object({ type: z.literal("changelogV3"), ...ChangelogSectionV3Schema.shape })
]);
export type NavigationTabV2 = z.infer<typeof NavigationTabV2Schema>;

export const UnversionedTabbedNavigationConfigSchema = z.object({
    tabs: z.array(NavigationTabSchema).optional(),
    tabsV2: z.array(NavigationTabV2Schema).optional(),
    landingPage: PageMetadataSchema.optional()
});
export type UnversionedTabbedNavigationConfig = z.infer<typeof UnversionedTabbedNavigationConfigSchema>;

export const UnversionedUntabbedNavigationConfigSchema = z.object({
    items: z.array(NavigationItemSchema),
    landingPage: PageMetadataSchema.optional()
});
export type UnversionedUntabbedNavigationConfig = z.infer<typeof UnversionedUntabbedNavigationConfigSchema>;

export const UnversionedNavigationConfigSchema = z.union([
    UnversionedTabbedNavigationConfigSchema,
    UnversionedUntabbedNavigationConfigSchema
]);
export type UnversionedNavigationConfig = z.infer<typeof UnversionedNavigationConfigSchema>;

export const VersionedNavigationConfigDataSchema = z.object({
    version: VersionIdSchema,
    urlSlugOverride: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    config: UnversionedNavigationConfigSchema
});
export type VersionedNavigationConfigData = z.infer<typeof VersionedNavigationConfigDataSchema>;

export const VersionedNavigationConfigSchema = z.object({
    versions: z.array(VersionedNavigationConfigDataSchema)
});
export type VersionedNavigationConfig = z.infer<typeof VersionedNavigationConfigSchema>;

export const NavigationConfigSchema = z.union([UnversionedNavigationConfigSchema, VersionedNavigationConfigSchema]);
export type NavigationConfig = z.infer<typeof NavigationConfigSchema>;

export const ThemeConfigSchema = z.object({
    logo: FileIdSchema.optional(),
    backgroundImage: FileIdSchema.optional(),
    accentPrimary: RgbaColorSchema,
    background: RgbaColorSchema.optional(),
    border: RgbaColorSchema.optional(),
    sidebarBackground: RgbaColorSchema.optional(),
    headerBackground: RgbaColorSchema.optional(),
    cardBackground: RgbaColorSchema.optional(),
    accent1: RgbaColorSchema.optional(),
    accent2: RgbaColorSchema.optional(),
    accent3: RgbaColorSchema.optional(),
    accent4: RgbaColorSchema.optional(),
    accent5: RgbaColorSchema.optional(),
    accent6: RgbaColorSchema.optional(),
    accent7: RgbaColorSchema.optional(),
    accent8: RgbaColorSchema.optional(),
    accent9: RgbaColorSchema.optional(),
    accent10: RgbaColorSchema.optional(),
    accent11: RgbaColorSchema.optional(),
    accent12: RgbaColorSchema.optional()
});
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const DarkAndLightModeConfigSchema = z.object({
    dark: ThemeConfigSchema,
    light: ThemeConfigSchema
});
export type DarkAndLightModeConfig = z.infer<typeof DarkAndLightModeConfigSchema>;

export const ColorsConfigV3Schema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("dark"), ...ThemeConfigSchema.shape }),
    z.object({ type: z.literal("light"), ...ThemeConfigSchema.shape }),
    z.object({ type: z.literal("darkAndLight"), ...DarkAndLightModeConfigSchema.shape })
]);
export type ColorsConfigV3 = z.infer<typeof ColorsConfigV3Schema>;

export const DocsConfigSchema = z.object({
    title: z.string().optional(),
    defaultLanguage: ProgrammingLanguageSchema.optional(),
    languages: z.array(LanguageSchema).optional(),
    announcement: z.object({ text: z.string() }).optional(),
    navigation: NavigationConfigSchema.optional(),
    root: z.custom<RootNode>().optional(),
    navbarLinks: z.array(NavbarLinkSchema).optional(),
    footerLinks: z.array(FooterLinkSchema).optional(),
    hideNavLinks: z.boolean().optional(),
    logoHeight: HeightSchema.optional(),
    logoHref: UrlSchema.optional(),
    logoRightText: z.string().optional(),
    favicon: FileIdSchema.optional(),
    metadata: MetadataConfigSchema.optional(),
    redirects: z.array(RedirectConfigSchema).optional(),
    colorsV3: ColorsConfigV3Schema.optional(),
    layout: DocsLayoutConfigSchema.optional(),
    theme: DocsThemeConfigSchema.optional(),
    settings: DocsSettingsConfigSchema.optional(),
    typographyV2: DocsTypographyConfigV2Schema.optional(),
    analyticsConfig: AnalyticsConfigSchema.optional(),
    integrations: IntegrationsConfigSchema.optional(),
    css: CssConfigSchema.optional(),
    js: JsConfigSchema.optional(),
    aiChatConfig: AIChatConfigSchema.optional(),
    pageActions: PageActionsConfigSchema.optional(),
    editThisPageLaunch: EditThisPageLaunchSchema.optional(),
    header: z.string().optional(),
    footer: z.string().optional(),
    backgroundImage: FileIdSchema.optional(),
    logoV2: ThemedFileIdSchema.optional(),
    logo: FileIdSchema.optional(),
    colors: ColorsConfigSchema.optional(),
    colorsV2: ColorsConfigV2Schema.optional(),
    typography: DocsTypographyConfigSchema.optional()
});
export type DocsConfig = z.infer<typeof DocsConfigSchema>;

export const DocsDefinitionSchema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    config: DocsConfigSchema,
    jsFiles: z.record(z.string(), z.string()).optional()
});
export type DocsDefinition = z.infer<typeof DocsDefinitionSchema>;

export const NpmPackageSchema = z.object({
    packageName: z.string(),
    githubRepoName: z.string(),
    version: z.string()
});
export type NpmPackage = z.infer<typeof NpmPackageSchema>;

export const MavenPackageSchema = z.object({
    coordinate: z.string(),
    githubRepoName: z.string(),
    version: z.string()
});
export type MavenPackage = z.infer<typeof MavenPackageSchema>;

export const PypiPackageSchema = z.object({
    packageName: z.string(),
    githubRepoName: z.string(),
    version: z.string()
});
export type PypiPackage = z.infer<typeof PypiPackageSchema>;

export const PublishedSdkSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("npm"), ...NpmPackageSchema.shape }),
    z.object({ type: z.literal("maven"), ...MavenPackageSchema.shape }),
    z.object({ type: z.literal("pypi"), ...PypiPackageSchema.shape })
]);
export type PublishedSdk = z.infer<typeof PublishedSdkSchema>;

export const PublishedPostmanCollectionSchema = z.object({
    url: UrlSchema,
    githubRepoName: z.string().optional()
});
export type PublishedPostmanCollection = z.infer<typeof PublishedPostmanCollectionSchema>;

export const ApiArtifactsSchema = z.object({
    sdks: z.array(PublishedSdkSchema),
    postman: PublishedPostmanCollectionSchema.optional()
});
export type ApiArtifacts = z.infer<typeof ApiArtifactsSchema>;

export const InvalidCustomDomainErrorBodySchema = z.object({
    overlappingDomains: z.array(z.array(z.string()))
});
export type InvalidCustomDomainErrorBody = z.infer<typeof InvalidCustomDomainErrorBodySchema>;

export const OverlappingCustomDomainsSchema = z.array(z.string());
export type OverlappingCustomDomains = z.infer<typeof OverlappingCustomDomainsSchema>;

export * from "./write-commons";
