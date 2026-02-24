import * as z from "zod";

import {
    AIChatConfigSchema,
    AnalyticsConfigSchema,
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
} from "./commons";

export const FilePathSchema = z.string();
export type FilePath = z.infer<typeof FilePathSchema>;

export const DocsRegistrationIdSchema = z.string();
export type DocsRegistrationId = z.infer<typeof DocsRegistrationIdSchema>;

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
    editThisPageUrl: UrlSchema.nullish(),
    editThisPageLaunch: EditThisPageLaunchSchema.nullish(),
    rawMarkdown: z.string().nullish()
});
export type PageContent = z.infer<typeof PageContentSchema>;

export const NavigationNodeMetadataSchema = z.object({
    icon: z.string().nullish(),
    hidden: z.boolean().nullish(),
    urlSlugOverride: z.string().nullish(),
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

export const ChangelogItemSchema = z.object({
    date: z.string(),
    pageId: PageIdSchema,
    hidden: z.boolean().nullish(),
    tags: z.array(z.string()).nullish()
});
export type ChangelogItem = z.infer<typeof ChangelogItemSchema>;

export const ChangelogSectionSchema = z.object({
    title: z.string().nullish(),
    icon: z.string().nullish(),
    hidden: z.boolean().nullish(),
    description: z.string().nullish(),
    pageId: PageIdSchema.nullish(),
    items: z.array(ChangelogItemSchema),
    urlSlug: z.string(),
    fullSlug: z.array(z.string()).nullish()
});
export type ChangelogSection = z.infer<typeof ChangelogSectionSchema>;

export const ChangelogSectionV2Schema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string().nullish(),
    description: z.string().nullish(),
    pageId: PageIdSchema.nullish(),
    items: z.array(ChangelogItemSchema)
});
export type ChangelogSectionV2 = z.infer<typeof ChangelogSectionV2Schema>;

export const ChangelogSectionV3Schema = z.object({
    node: z.unknown()
});
export type ChangelogSectionV3 = z.infer<typeof ChangelogSectionV3Schema>;

export const NavigationTabLinkSchema = z.object({
    title: z.string(),
    icon: z.string().nullish(),
    url: UrlSchema,
    target: LinkTargetSchema.nullish()
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
    export interface Page extends PageMetadata {
        type: "page";
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
        z.object({ type: z.literal("page"), ...PageMetadataSchema.shape })
    ])
);

export const ApiNavigationConfigSubpackageSchema = z.object({
    summaryPageId: PageIdSchema.nullish(),
    subpackageId: SubpackageIdSchema,
    items: z.array(ApiNavigationConfigItemSchema)
});
export type ApiNavigationConfigSubpackage = z.infer<typeof ApiNavigationConfigSubpackageSchema>;

export const ApiNavigationConfigRootSchema = z.object({
    summaryPageId: PageIdSchema.nullish(),
    items: z.array(ApiNavigationConfigItemSchema)
});
export type ApiNavigationConfigRoot = z.infer<typeof ApiNavigationConfigRootSchema>;

export const ApiSectionSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string(),
    api: z.string().uuid(),
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
                    githubRepoName: z.string().nullish()
                })
                .nullish()
        })
        .nullish(),
    skipUrlSlug: z.boolean().nullish(),
    showErrors: z.boolean().nullish(),
    changelog: ChangelogSectionSchema.nullish(),
    changelogV2: ChangelogSectionV2Schema.nullish(),
    navigation: ApiNavigationConfigRootSchema.nullish(),
    longScrolling: z.boolean().nullish(),
    flattened: z.boolean().nullish()
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
    collapsed?: boolean | null;
    collapsible?: boolean | null;
    collapsedByDefault?: boolean | null;
    skipUrlSlug?: boolean | null;
    overviewPageId?: string | null;
};

export const DocsSectionSchema: z.ZodType<DocsSection> = z.lazy(() =>
    z.object({
        ...NavigationNodeMetadataSchema.shape,
        title: z.string(),
        items: z.array(NavigationItemSchema),
        collapsed: z.boolean().nullish(),
        collapsible: z.boolean().nullish(),
        collapsedByDefault: z.boolean().nullish(),
        skipUrlSlug: z.boolean().nullish(),
        overviewPageId: PageIdSchema.nullish()
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
            collapsed: z.boolean().nullish(),
            collapsible: z.boolean().nullish(),
            collapsedByDefault: z.boolean().nullish(),
            skipUrlSlug: z.boolean().nullish(),
            overviewPageId: PageIdSchema.nullish()
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
    skipUrlSlug: z.boolean().nullish()
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
    tabs: z.array(NavigationTabSchema).nullish(),
    tabsV2: z.array(NavigationTabV2Schema).nullish(),
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
    urlSlugOverride: z.string().nullish(),
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

export const ThemeConfigSchema = z.object({
    logo: FileIdSchema.nullish(),
    backgroundImage: FileIdSchema.nullish(),
    accentPrimary: RgbaColorSchema,
    background: RgbaColorSchema.nullish(),
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

export const DocsConfigSchema = z.object({
    title: z.string().nullish(),
    defaultLanguage: ProgrammingLanguageSchema.nullish(),
    languages: z.array(LanguageSchema).nullish(),
    announcement: z.object({ text: z.string() }).nullish(),
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
    footer: z.string().nullish(),
    backgroundImage: FileIdSchema.nullish(),
    logoV2: ThemedFileIdSchema.nullish(),
    logo: FileIdSchema.nullish(),
    colors: ColorsConfigSchema.nullish(),
    colorsV2: ColorsConfigV2Schema.nullish(),
    typography: DocsTypographyConfigSchema.nullish()
});
export type DocsConfig = z.infer<typeof DocsConfigSchema>;

export const DocsDefinitionSchema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    config: DocsConfigSchema,
    jsFiles: z.record(z.string(), z.string()).nullish()
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
    githubRepoName: z.string().nullish()
});
export type PublishedPostmanCollection = z.infer<typeof PublishedPostmanCollectionSchema>;

export const ApiArtifactsSchema = z.object({
    sdks: z.array(PublishedSdkSchema),
    postman: PublishedPostmanCollectionSchema.nullish()
});
export type ApiArtifacts = z.infer<typeof ApiArtifactsSchema>;

export const InvalidCustomDomainErrorBodySchema = z.object({
    overlappingDomains: z.array(z.array(z.string()))
});
export type InvalidCustomDomainErrorBody = z.infer<typeof InvalidCustomDomainErrorBodySchema>;

export const OverlappingCustomDomainsSchema = z.array(z.string());
export type OverlappingCustomDomains = z.infer<typeof OverlappingCustomDomainsSchema>;

export * from "./commons";
