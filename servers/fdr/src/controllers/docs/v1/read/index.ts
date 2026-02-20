import * as z from "zod";

import {
    AIChatConfigSchema,
    AnalyticsConfigSchema,
    AnnouncementConfigSchema,
    ApiDefinitionIdSchema,
    AvailabilitySchema,
    CssConfigSchema,
    DocsConfigIdSchema,
    DocsLayoutConfigSchema,
    DocsSettingsConfigSchema,
    DocsThemeConfigSchema,
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
    UrlSchema,
    VersionIdSchema,
    WebhookIdSchema,
    WebSocketIdSchema
} from "./commons";

export const HeightSchema = z.number();
export type Height = z.infer<typeof HeightSchema>;

export const UrlFileSchema = z.object({
    url: UrlSchema
});
export type UrlFile = z.infer<typeof UrlFileSchema>;

export const ImageFileSchema = z.object({
    url: UrlSchema,
    width: z.number(),
    height: z.number(),
    blurDataUrl: z.string().nullish(),
    alt: z.string().nullish()
});
export type ImageFile = z.infer<typeof ImageFileSchema>;

export const FileSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("url"), ...UrlFileSchema.shape }),
    z.object({ type: z.literal("image"), ...ImageFileSchema.shape })
]);
export type File_ = z.infer<typeof FileSchema>;

export const PageContentSchema = z.object({
    markdown: z.string(),
    editThisPageUrl: UrlSchema.nullish(),
    editThisPageLaunch: EditThisPageLaunchSchema.nullish(),
    rawMarkdown: z.string().nullish()
});
export type PageContent = z.infer<typeof PageContentSchema>;

export const BackgroundSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("solid"), value: RgbaColorSchema }),
    z.object({ type: z.literal("gradient") })
]);
export type Background = z.infer<typeof BackgroundSchema>;

export const ThemeConfigSchema = z.object({
    logo: FileIdSchema.nullish(),
    backgroundImage: FileIdSchema.nullish(),
    accentPrimary: RgbaColorSchema,
    background: BackgroundSchema,
    border: RgbaColorSchema.nullish(),
    sidebarBackground: RgbaColorSchema.nullish(),
    headerBackground: RgbaColorSchema.nullish(),
    cardBackground: RgbaColorSchema.nullish(),
    accent1: RgbaColorSchema.nullish(),
    accent2: RgbaColorSchema.nullish(),
    accent3: RgbaColorSchema.nullish(),
    accent4: RgbaColorSchema.nullish(),
    accent5: RgbaColorSchema.nullish(),
    accent6: RgbaColorSchema.nullish(),
    accent7: RgbaColorSchema.nullish(),
    accent8: RgbaColorSchema.nullish(),
    accent9: RgbaColorSchema.nullish(),
    accent10: RgbaColorSchema.nullish(),
    accent11: RgbaColorSchema.nullish(),
    accent12: RgbaColorSchema.nullish()
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

export const NavigationNodeMetadataSchema = z.object({
    icon: z.string().nullish(),
    hidden: z.boolean().nullish(),
    urlSlug: z.string(),
    fullSlug: z.array(z.string()).nullish()
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
    icon: z.string().nullish(),
    url: UrlSchema,
    target: LinkTargetSchema.nullish()
});
export type LinkMetadata = z.infer<typeof LinkMetadataSchema>;

export const NavigationTabLinkSchema = z.object({
    title: z.string(),
    icon: z.string().nullish(),
    url: UrlSchema,
    target: LinkTargetSchema.nullish()
});
export type NavigationTabLink = z.infer<typeof NavigationTabLinkSchema>;

export const ChangelogItemSchema = z.object({
    date: z.string(),
    pageId: PageIdSchema,
    tags: z.array(z.string()).nullish()
});
export type ChangelogItem = z.infer<typeof ChangelogItemSchema>;

export const ChangelogSectionSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string().nullish(),
    description: z.string().nullish(),
    pageId: PageIdSchema.nullish(),
    items: z.array(ChangelogItemSchema)
});
export type ChangelogSection = z.infer<typeof ChangelogSectionSchema>;

export const ChangelogSectionV3Schema = z.object({
    node: z.unknown()
});
export type ChangelogSectionV3 = z.infer<typeof ChangelogSectionV3Schema>;

export const SubpackageIdSchema = z.string();
export type SubpackageId = z.infer<typeof SubpackageIdSchema>;

export type ApiNavigationConfigItem =
    | ApiNavigationConfigItem.Subpackage
    | ApiNavigationConfigItem.EndpointId
    | ApiNavigationConfigItem.WebsocketId
    | ApiNavigationConfigItem.WebhookId
    | ApiNavigationConfigItem.Page;

export namespace ApiNavigationConfigItem {
    export interface Subpackage {
        type: "subpackage";
        summaryPageId?: string | null;
        subpackageId: string;
        items: ApiNavigationConfigItem[];
    }
    export interface EndpointId {
        type: "endpointId";
        value: string;
    }
    export interface WebsocketId {
        type: "websocketId";
        value: string;
    }
    export interface WebhookId {
        type: "webhookId";
        value: string;
    }
    export interface Page {
        type: "page";
        icon?: string | null;
        hidden?: boolean | null;
        urlSlug: string;
        fullSlug?: string[] | null;
        id: string;
        title: string;
    }
}

export const ApiNavigationConfigItemSchema: z.ZodType<ApiNavigationConfigItem> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("subpackage"),
            summaryPageId: PageIdSchema.nullish(),
            subpackageId: SubpackageIdSchema,
            items: z.array(ApiNavigationConfigItemSchema)
        }),
        z.object({ type: z.literal("endpointId"), value: EndpointIdSchema }),
        z.object({ type: z.literal("websocketId"), value: WebSocketIdSchema }),
        z.object({ type: z.literal("webhookId"), value: WebhookIdSchema }),
        z.object({
            type: z.literal("page"),
            ...PageMetadataSchema.shape
        })
    ])
);

export const ApiNavigationConfigRootSchema = z.object({
    summaryPageId: PageIdSchema.nullish(),
    items: z.array(ApiNavigationConfigItemSchema)
});
export type ApiNavigationConfigRoot = z.infer<typeof ApiNavigationConfigRootSchema>;

export const ApiSectionSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string(),
    api: ApiDefinitionIdSchema,
    skipUrlSlug: z.boolean(),
    artifacts: z.lazy(() => ApiArtifactsSchema).nullish(),
    showErrors: z.boolean(),
    changelog: ChangelogSectionSchema.nullish(),
    navigation: ApiNavigationConfigRootSchema.nullish(),
    longScrolling: z.boolean().nullish(),
    flattened: z.boolean().nullish()
});
export type ApiSection = z.infer<typeof ApiSectionSchema>;

export const ApiSectionV2Schema = z.object({
    node: z.unknown()
});
export type ApiSectionV2 = z.infer<typeof ApiSectionV2Schema>;

export const DocsSectionSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        ...NavigationNodeMetadataSchema.shape,
        title: z.string(),
        items: z.array(NavigationItemSchema),
        skipUrlSlug: z.boolean(),
        collapsed: z.boolean(),
        overviewPageId: PageIdSchema.nullish()
    })
);
export type DocsSection = z.infer<typeof DocsSectionSchema>;

export const NavigationItemSchema: z.ZodType<any> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({ type: z.literal("page"), ...PageMetadataSchema.shape }),
        z.object({ type: z.literal("api"), ...ApiSectionSchema.shape }),
        z.object({ type: z.literal("apiV2"), ...ApiSectionV2Schema.shape }),
        z.object({
            type: z.literal("section"),
            ...NavigationNodeMetadataSchema.shape,
            title: z.string(),
            items: z.array(NavigationItemSchema),
            skipUrlSlug: z.boolean(),
            collapsed: z.boolean(),
            overviewPageId: PageIdSchema.nullish()
        }),
        z.object({ type: z.literal("link"), ...LinkMetadataSchema.shape }),
        z.object({ type: z.literal("changelog"), ...ChangelogSectionSchema.shape }),
        z.object({ type: z.literal("changelogV3"), ...ChangelogSectionV3Schema.shape })
    ])
);
export type NavigationItem = z.infer<typeof NavigationItemSchema>;

export const NavigationTabGroupSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string(),
    items: z.array(NavigationItemSchema),
    skipUrlSlug: z.boolean()
});
export type NavigationTabGroup = z.infer<typeof NavigationTabGroupSchema>;

export const NavigationTabSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("group"), ...NavigationTabGroupSchema.shape }),
    z.object({ type: z.literal("link"), ...NavigationTabLinkSchema.shape }),
    z.object({ type: z.literal("changelog"), ...ChangelogSectionSchema.shape }),
    z.object({ type: z.literal("changelogV3"), ...ChangelogSectionV3Schema.shape })
]);
export type NavigationTab = z.infer<typeof NavigationTabSchema>;

export const UnversionedTabbedNavigationConfigSchema = z.object({
    tabs: z.array(NavigationTabSchema),
    landingPage: PageMetadataSchema.nullish()
});
export type UnversionedTabbedNavigationConfig = z.infer<typeof UnversionedTabbedNavigationConfigSchema>;

export const UnversionedUntabbedNavigationConfigSchema = z.object({
    items: z.array(NavigationItemSchema),
    landingPage: PageMetadataSchema.nullish()
});
export type UnversionedUntabbedNavigationConfig = z.infer<typeof UnversionedUntabbedNavigationConfigSchema>;

export const UnversionedNavigationConfigSchema = z.union([
    UnversionedTabbedNavigationConfigSchema,
    UnversionedUntabbedNavigationConfigSchema
]);
export type UnversionedNavigationConfig = z.infer<typeof UnversionedNavigationConfigSchema>;

export const VersionedNavigationConfigDataSchema = z.object({
    version: VersionIdSchema,
    urlSlug: z.string(),
    availability: AvailabilitySchema.nullish(),
    config: UnversionedNavigationConfigSchema
});
export type VersionedNavigationConfigData = z.infer<typeof VersionedNavigationConfigDataSchema>;

export const VersionedNavigationConfigSchema = z.object({
    versions: z.array(VersionedNavigationConfigDataSchema)
});
export type VersionedNavigationConfig = z.infer<typeof VersionedNavigationConfigSchema>;

export const NavigationConfigSchema = z.union([UnversionedNavigationConfigSchema, VersionedNavigationConfigSchema]);
export type NavigationConfig = z.infer<typeof NavigationConfigSchema>;

export const DocsConfigSchema = z.object({
    title: z.string().nullish(),
    defaultLanguage: ProgrammingLanguageSchema.nullish(),
    languages: z.array(LanguageSchema).nullish(),
    announcement: AnnouncementConfigSchema.nullish(),
    navigation: NavigationConfigSchema.nullish(),
    root: z.unknown().nullish(),
    navbarLinks: z.array(NavbarLinkSchema).nullish(),
    footerLinks: z.array(FooterLinkSchema).nullish(),
    hideNavLinks: z.boolean().nullish(),
    logoHeight: HeightSchema.nullish(),
    logoHref: UrlSchema.nullish(),
    logoRightText: z.string().nullish(),
    favicon: FileIdSchema.nullish(),
    metadata: MetadataConfigSchema.nullish(),
    redirects: z.array(RedirectConfigSchema).nullish(),
    colorsV3: ColorsConfigV3Schema.nullish(),
    layout: DocsLayoutConfigSchema.nullish(),
    theme: DocsThemeConfigSchema.nullish(),
    settings: DocsSettingsConfigSchema.nullish(),
    typographyV2: DocsTypographyConfigV2Schema.nullish(),
    analyticsConfig: AnalyticsConfigSchema.nullish(),
    integrations: IntegrationsConfigSchema.nullish(),
    css: CssConfigSchema.nullish(),
    js: JsConfigSchema.nullish(),
    aiChatConfig: AIChatConfigSchema.nullish(),
    pageActions: PageActionsConfigSchema.nullish(),
    editThisPageLaunch: EditThisPageLaunchSchema.nullish(),
    header: z.string().nullish(),
    footer: z.string().nullish()
});
export type DocsConfig = z.infer<typeof DocsConfigSchema>;

export const DocsDefinitionSchema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    apis: z.record(ApiDefinitionIdSchema, z.unknown()),
    apisV2: z.record(ApiDefinitionIdSchema, z.unknown()),
    apiNameToId: z.record(z.string(), ApiDefinitionIdSchema).nullish(),
    files: z.record(FileIdSchema, UrlSchema),
    filesV2: z.record(FileIdSchema, FileSchema),
    jsFiles: z.record(z.string(), z.string()).nullish(),
    id: DocsConfigIdSchema.nullish(),
    config: DocsConfigSchema
});
export type DocsDefinition = z.infer<typeof DocsDefinitionSchema>;

export const LoadDocsForUrlResponseSchema = z.object({
    baseUrl: z.string(),
    definition: DocsDefinitionSchema
});
export type LoadDocsForUrlResponse = z.infer<typeof LoadDocsForUrlResponseSchema>;

export const GitHubRepoSchema = z.object({
    name: z.string(),
    url: UrlSchema
});
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

export const NpmPackageSchema = z.object({
    packageName: z.string(),
    githubRepo: GitHubRepoSchema,
    version: z.string()
});
export type NpmPackage = z.infer<typeof NpmPackageSchema>;

export const MavenPackageSchema = z.object({
    coordinate: z.string(),
    githubRepo: GitHubRepoSchema,
    version: z.string()
});
export type MavenPackage = z.infer<typeof MavenPackageSchema>;

export const PypiPackageSchema = z.object({
    packageName: z.string(),
    githubRepo: GitHubRepoSchema,
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
    githubRepo: GitHubRepoSchema.nullish()
});
export type PublishedPostmanCollection = z.infer<typeof PublishedPostmanCollectionSchema>;

export const ApiArtifactsSchema = z.object({
    sdks: z.array(PublishedSdkSchema),
    postman: PublishedPostmanCollectionSchema.nullish()
});
export type ApiArtifacts = z.infer<typeof ApiArtifactsSchema>;

export * from "./commons";
