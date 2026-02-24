import * as z from "zod";
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
} from "../shared";
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
} from "./commons";

export type { ApiNavigationConfigItem } from "../shared";

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
} from "../shared";

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

export const ApiNavigationConfigItemSchema = SharedApiNavigationConfigItemSchema;
export const ApiNavigationConfigRootSchema = SharedApiNavigationConfigRootSchema;
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

export const DocsSectionSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        ...NavigationNodeMetadataSchema.shape,
        title: z.string(),
        items: z.array(NavigationItemSchema),
        skipUrlSlug: z.boolean(),
        collapsed: z.boolean(),
        collapsible: z.boolean().nullish(),
        collapsedByDefault: z.boolean().nullish(),
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
            collapsible: z.boolean().nullish(),
            collapsedByDefault: z.boolean().nullish(),
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

export * from "./commons";
