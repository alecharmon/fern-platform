import * as z from "zod";
import type { PageId, Url } from "./read-commons";
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
    FileIdSchema,
    FooterLinkSchema,
    IntegrationsConfigSchema,
    JsConfigSchema,
    LanguageSchema,
    MetadataConfigSchema,
    NavbarLinkSchema,
    PageActionsConfigSchema,
    ProgrammingLanguageSchema,
    RedirectConfigSchema,
    RgbaColorSchema,
    UrlSchema
} from "./read-commons";
import {
    ApiArtifactsSchema,
    ApiSectionV2Schema,
    ChangelogItemSchema,
    ChangelogSectionSchema,
    ChangelogSectionV3Schema,
    GitHubRepoSchema,
    HeightSchema,
    LinkMetadataSchema,
    MavenPackageSchema,
    NavigationNodeMetadataSchema,
    NavigationTabLinkSchema,
    NpmPackageSchema,
    PageContentSchema,
    PageIdSchema,
    PageMetadataSchema,
    PublishedPostmanCollectionSchema,
    PublishedSdkSchema,
    PypiPackageSchema,
    ApiNavigationConfigItemSchema as SharedApiNavigationConfigItemSchema,
    ApiNavigationConfigRootSchema as SharedApiNavigationConfigRootSchema,
    SubpackageIdSchema,
    VersionIdSchema
} from "./shared";

export type { ApiNavigationConfigItem } from "./shared";

export {
    ApiArtifactsSchema,
    ApiSectionV2Schema,
    ChangelogItemSchema,
    ChangelogSectionSchema,
    ChangelogSectionV3Schema,
    GitHubRepoSchema,
    HeightSchema,
    LinkMetadataSchema,
    MavenPackageSchema,
    NavigationNodeMetadataSchema,
    NavigationTabLinkSchema,
    NpmPackageSchema,
    PageContentSchema,
    PageMetadataSchema,
    PublishedPostmanCollectionSchema,
    PublishedSdkSchema,
    PypiPackageSchema,
    SubpackageIdSchema
};

export type {
    ApiArtifacts,
    ApiSectionV2,
    ChangelogItem,
    ChangelogSection,
    ChangelogSectionV3,
    GitHubRepo,
    Height,
    LinkMetadata,
    MavenPackage,
    NavigationNodeMetadata,
    NavigationTabLink,
    NpmPackage,
    PageContent,
    PageMetadata,
    PublishedPostmanCollection,
    PublishedSdk,
    PypiPackage,
    SubpackageId
} from "./shared";

export const UrlFileSchema = z.object({
    url: UrlSchema
});
export type UrlFile = z.infer<typeof UrlFileSchema>;

export const ImageFileSchema = z.object({
    url: UrlSchema,
    width: z.number(),
    height: z.number(),
    blurDataUrl: z.string().optional(),
    alt: z.string().optional()
});
export type ImageFile = z.infer<typeof ImageFileSchema>;

export const FileSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("url"), ...UrlFileSchema.shape }),
    z.object({ type: z.literal("image"), ...ImageFileSchema.shape })
]);
export type File_ = z.infer<typeof FileSchema>;

export const BackgroundSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("solid"), ...RgbaColorSchema.shape }),
    z.object({ type: z.literal("gradient") })
]);
export type Background = z.infer<typeof BackgroundSchema>;

export const ThemeConfigSchema = z.object({
    logo: FileIdSchema.optional(),
    backgroundImage: FileIdSchema.optional(),
    accentPrimary: RgbaColorSchema,
    background: BackgroundSchema,
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

export const ApiNavigationConfigItemSchema = SharedApiNavigationConfigItemSchema;
export const ApiNavigationConfigRootSchema = SharedApiNavigationConfigRootSchema;
export type ApiNavigationConfigRoot = z.infer<typeof ApiNavigationConfigRootSchema>;

export const ApiSectionSchema = z.object({
    ...NavigationNodeMetadataSchema.shape,
    title: z.string(),
    api: ApiDefinitionIdSchema,
    skipUrlSlug: z.boolean(),
    artifacts: z.lazy(() => ApiArtifactsSchema).optional(),
    showErrors: z.boolean(),
    changelog: ChangelogSectionSchema.optional(),
    navigation: ApiNavigationConfigRootSchema.optional(),
    longScrolling: z.boolean().optional(),
    flattened: z.boolean().optional()
});
export type ApiSection = z.infer<typeof ApiSectionSchema>;

export const DocsSectionSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        ...NavigationNodeMetadataSchema.shape,
        title: z.string(),
        items: z.array(NavigationItemSchema),
        skipUrlSlug: z.boolean(),
        collapsed: z.boolean(),
        overviewPageId: PageIdSchema.optional()
    })
);
export type DocsSection = z.infer<typeof DocsSectionSchema>;

export type NavigationItem =
    | NavigationItem.Page
    | NavigationItem.Api
    | NavigationItem.ApiV2
    | NavigationItem.Section
    | NavigationItem.Link
    | NavigationItem.Changelog
    | NavigationItem.ChangelogV3;

export namespace NavigationItem {
    export interface Page {
        type: "page";
        icon?: string;
        hidden?: boolean;
        urlSlug: string;
        fullSlug?: string[];
        id: PageId;
        title: string;
    }
    export interface Api extends ApiSection {
        type: "api";
    }
    export interface ApiV2 {
        type: "apiV2";
        node?: unknown;
    }
    export interface Section {
        type: "section";
        icon?: string;
        hidden?: boolean;
        urlSlug: string;
        fullSlug?: string[];
        skipUrlSlug: boolean;
        title: string;
        items: NavigationItem[];
        collapsed: boolean;
        overviewPageId?: PageId;
    }
    export interface Link {
        type: "link";
        url: Url;
        title: string;
        icon?: string;
        target?: "_blank" | "_self" | "_parent" | "_top";
    }
    export interface Changelog {
        type: "changelog";
        icon?: string;
        hidden?: boolean;
        urlSlug: string;
        fullSlug?: string[];
        title?: string;
        description?: string;
        pageId?: PageId;
        items: Array<{ date: string; pageId: PageId; tags?: string[] }>;
    }
    export interface ChangelogV3 {
        type: "changelogV3";
        node?: unknown;
    }
}

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
            skipUrlSlug: z.boolean(),
            collapsed: z.boolean(),
            overviewPageId: PageIdSchema.optional()
        }),
        z.object({ type: z.literal("link"), ...LinkMetadataSchema.shape }),
        z.object({ type: z.literal("changelog"), ...ChangelogSectionSchema.shape }),
        z.object({ type: z.literal("changelogV3"), ...ChangelogSectionV3Schema.shape })
    ])
) as z.ZodType<NavigationItem>;

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
    urlSlug: z.string(),
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

export const DocsConfigSchema = z.object({
    title: z.string().optional(),
    defaultLanguage: ProgrammingLanguageSchema.optional(),
    languages: z.array(LanguageSchema).optional(),
    announcement: AnnouncementConfigSchema.optional(),
    navigation: NavigationConfigSchema.optional(),
    root: z.unknown().optional(),
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
    footer: z.string().optional()
});
export type DocsConfig = z.infer<typeof DocsConfigSchema>;

export const DocsDefinitionSchema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    apis: z.record(ApiDefinitionIdSchema, z.unknown()),
    apisV2: z.record(ApiDefinitionIdSchema, z.unknown()),
    apiNameToId: z.record(z.string(), ApiDefinitionIdSchema).optional(),
    files: z.record(FileIdSchema, UrlSchema),
    filesV2: z.record(FileIdSchema, FileSchema),
    jsFiles: z.record(z.string(), z.string()).optional(),
    id: DocsConfigIdSchema.optional(),
    config: DocsConfigSchema
});
export type DocsDefinition = z.infer<typeof DocsDefinitionSchema>;

export const BaseUrlSchema = z.object({
    domain: z.string(),
    basePath: z.string().optional()
});
export type BaseUrl = z.infer<typeof BaseUrlSchema>;

export const LoadDocsForUrlResponseSchema = z.object({
    baseUrl: BaseUrlSchema,
    definition: DocsDefinitionSchema,
    orgId: z.string().optional(),
    lightModeEnabled: z.boolean().optional()
});
export type LoadDocsForUrlResponse = z.infer<typeof LoadDocsForUrlResponseSchema>;

export * from "./read-commons";
