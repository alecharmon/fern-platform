import * as z from "zod";

export const FileIdSchema = z.string();
export type FileId = z.infer<typeof FileIdSchema>;

export const PageIdSchema = z.string();
export type PageId = z.infer<typeof PageIdSchema>;

export const UrlSchema = z.string();
export type Url = z.infer<typeof UrlSchema>;

export const VersionIdSchema = z.string();
export type VersionId = z.infer<typeof VersionIdSchema>;

export const ApiDefinitionIdSchema = z.string().uuid();
export type ApiDefinitionId = z.infer<typeof ApiDefinitionIdSchema>;

export const EndpointIdSchema = z.string();
export type EndpointId = z.infer<typeof EndpointIdSchema>;

export const WebSocketIdSchema = z.string();
export type WebSocketId = z.infer<typeof WebSocketIdSchema>;

export const WebhookIdSchema = z.string();
export type WebhookId = z.infer<typeof WebhookIdSchema>;

export const RoleIdSchema = z.string();
export type RoleId = z.infer<typeof RoleIdSchema>;

export const SubpackageIdSchema = z.string();
export type SubpackageId = z.infer<typeof SubpackageIdSchema>;

export const LinkTargetSchema = z.enum(["_blank", "_self", "_parent", "_top"]);
export type LinkTarget = z.infer<typeof LinkTargetSchema>;

export const AvailabilitySchema = z.enum([
    "Stable",
    "GenerallyAvailable",
    "InDevelopment",
    "PreRelease",
    "Deprecated",
    "Beta"
]);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const RgbaColorSchema = z.object({
    r: z.number().int(),
    g: z.number().int(),
    b: z.number().int(),
    a: z.number().nullish()
});
export type RgbaColor = z.infer<typeof RgbaColorSchema>;

export const FileIdOrUrlSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("fileId"), value: FileIdSchema }),
    z.object({ type: z.literal("url"), value: UrlSchema })
]);
export type FileIdOrUrl = z.infer<typeof FileIdOrUrlSchema>;

export const LanguageSchema = z.enum([
    "en",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "ja",
    "zh",
    "ko",
    "el",
    "no",
    "pl",
    "ru",
    "sv",
    "tr"
]);
export type Language = z.infer<typeof LanguageSchema>;

export const ProgrammingLanguageSchema = z.enum([
    "typescript",
    "javascript",
    "python",
    "java",
    "go",
    "ruby",
    "csharp",
    "php",
    "swift",
    "rust",
    "nodets",
    "nodejs",
    "dotnet",
    "curl",
    "jvm",
    "ts",
    "js"
]);
export type ProgrammingLanguage = z.infer<typeof ProgrammingLanguageSchema>;

export const AnnouncementConfigSchema = z.object({
    text: z.string()
});
export type AnnouncementConfig = z.infer<typeof AnnouncementConfigSchema>;

export const SegmentConfigSchema = z.object({
    writeKey: z.string()
});
export type SegmentConfig = z.infer<typeof SegmentConfigSchema>;

export const FullStoryAnalyticsConfigSchema = z.object({
    orgId: z.string()
});
export type FullStoryAnalyticsConfig = z.infer<typeof FullStoryAnalyticsConfigSchema>;

export const IntercomConfigSchema = z.object({
    appId: z.string(),
    apiBase: z.string().nullish()
});
export type IntercomConfig = z.infer<typeof IntercomConfigSchema>;

export const PostHogConfigSchema = z.object({
    apiKey: z.string(),
    endpoint: z.string().nullish()
});
export type PostHogConfig = z.infer<typeof PostHogConfigSchema>;

export const GTMConfigSchema = z.object({
    containerId: z.string()
});
export type GTMConfig = z.infer<typeof GTMConfigSchema>;

export const GoogleAnalytics4ConfigSchema = z.object({
    measurementId: z.string()
});
export type GoogleAnalytics4Config = z.infer<typeof GoogleAnalytics4ConfigSchema>;

export const AmplitudeConfigSchema = z.object({
    apiKey: z.string()
});
export type AmplitudeConfig = z.infer<typeof AmplitudeConfigSchema>;

export const MixpanelConfigSchema = z.object({
    apiKey: z.string()
});
export type MixpanelConfig = z.infer<typeof MixpanelConfigSchema>;

export const HotJarConfigSchema = z.object({
    hjid: z.string(),
    hjsv: z.string()
});
export type HotJarConfig = z.infer<typeof HotJarConfigSchema>;

export const KoalaConfigSchema = z.object({
    apiKey: z.string()
});
export type KoalaConfig = z.infer<typeof KoalaConfigSchema>;

export const LogRocketConfigSchema = z.object({
    apiKey: z.string()
});
export type LogRocketConfig = z.infer<typeof LogRocketConfigSchema>;

export const PirschConfigSchema = z.object({
    id: z.string()
});
export type PirschConfig = z.infer<typeof PirschConfigSchema>;

export const PlausibleConfigSchema = z.object({
    domain: z.string()
});
export type PlausibleConfig = z.infer<typeof PlausibleConfigSchema>;

export const FathomConfigSchema = z.object({
    siteId: z.string()
});
export type FathomConfig = z.infer<typeof FathomConfigSchema>;

export const ClearBitConfigSchema = z.object({
    apiKey: z.string()
});
export type ClearBitConfig = z.infer<typeof ClearBitConfigSchema>;

export const HeapConfigSchema = z.object({
    appId: z.string()
});
export type HeapConfig = z.infer<typeof HeapConfigSchema>;

export const AnalyticsConfigSchema = z.object({
    segment: SegmentConfigSchema.nullish(),
    fullstory: FullStoryAnalyticsConfigSchema.nullish(),
    intercom: IntercomConfigSchema.nullish(),
    posthog: PostHogConfigSchema.nullish(),
    gtm: GTMConfigSchema.nullish(),
    ga4: GoogleAnalytics4ConfigSchema.nullish(),
    amplitude: AmplitudeConfigSchema.nullish(),
    mixpanel: MixpanelConfigSchema.nullish(),
    hotjar: HotJarConfigSchema.nullish(),
    koala: KoalaConfigSchema.nullish(),
    logrocket: LogRocketConfigSchema.nullish(),
    pirsch: PirschConfigSchema.nullish(),
    plausible: PlausibleConfigSchema.nullish(),
    fathom: FathomConfigSchema.nullish(),
    clearbit: ClearBitConfigSchema.nullish(),
    heap: HeapConfigSchema.nullish()
});
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>;

export const SearchbarPlacementSchema = z.enum(["HEADER", "HEADER_TABS", "SIDEBAR"]);
export type SearchbarPlacement = z.infer<typeof SearchbarPlacementSchema>;

export const TabsPlacementSchema = z.enum(["HEADER", "SIDEBAR"]);
export type TabsPlacement = z.infer<typeof TabsPlacementSchema>;

export const SwitcherPlacementSchema = z.enum(["HEADER", "SIDEBAR"]);
export type SwitcherPlacement = z.infer<typeof SwitcherPlacementSchema>;

export const ContentAlignmentSchema = z.enum(["CENTER", "LEFT"]);
export type ContentAlignment = z.infer<typeof ContentAlignmentSchema>;

export const HeaderPositionSchema = z.enum(["FIXED", "ABSOLUTE"]);
export type HeaderPosition = z.infer<typeof HeaderPositionSchema>;

export const PageWidthSizeConfigSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("px"), value: z.number() }),
    z.object({ type: z.literal("rem"), value: z.number() }),
    z.object({ type: z.literal("full") })
]);
export type PageWidthSizeConfig = z.infer<typeof PageWidthSizeConfigSchema>;

export const SizeConfigSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("px"), value: z.number() }),
    z.object({ type: z.literal("rem"), value: z.number() })
]);
export type SizeConfig = z.infer<typeof SizeConfigSchema>;

export const TabsAlignmentSchema = z.enum(["LEFT", "CENTER"]);
export type TabsAlignment = z.infer<typeof TabsAlignmentSchema>;

export const DocsLayoutConfigSchema = z.object({
    pageWidth: PageWidthSizeConfigSchema.nullish(),
    contentWidth: SizeConfigSchema.nullish(),
    sidebarWidth: SizeConfigSchema.nullish(),
    headerHeight: SizeConfigSchema.nullish(),
    searchbarPlacement: SearchbarPlacementSchema.nullish(),
    tabsPlacement: TabsPlacementSchema.nullish(),
    switcherPlacement: SwitcherPlacementSchema.nullish(),
    contentAlignment: ContentAlignmentSchema.nullish(),
    headerPosition: HeaderPositionSchema.nullish(),
    disableHeader: z.boolean().nullish(),
    hideNavLinks: z.boolean().nullish(),
    hideFeedback: z.boolean().nullish()
});
export type DocsLayoutConfig = z.infer<typeof DocsLayoutConfigSchema>;

export const FooterNavConfigSchema = z.enum(["default", "minimal"]);
export type FooterNavConfig = z.infer<typeof FooterNavConfigSchema>;

export const DocsSidebarConfigSchema = z.enum(["default", "minimal"]);
export type DocsSidebarConfig = z.infer<typeof DocsSidebarConfigSchema>;

export const DocsBodyConfigSchema = z.enum(["default", "canvas"]);
export type DocsBodyConfig = z.infer<typeof DocsBodyConfigSchema>;

export const DocsTabsStyleSchema = z.enum(["default", "bubble"]);
export type DocsTabsStyle = z.infer<typeof DocsTabsStyleSchema>;

export const DocsTabsObjectConfigSchema = z.object({
    style: DocsTabsStyleSchema.nullish(),
    alignment: TabsAlignmentSchema.nullish(),
    placement: TabsPlacementSchema.nullish()
});
export type DocsTabsObjectConfig = z.infer<typeof DocsTabsObjectConfigSchema>;

export const DocsTabsConfigSchema = z.union([DocsTabsStyleSchema, DocsTabsObjectConfigSchema]);
export type DocsTabsConfig = z.infer<typeof DocsTabsConfigSchema>;

export const DocsPageActionsConfigSchema = z.enum(["default", "toolbar"]);
export type DocsPageActionsConfig = z.infer<typeof DocsPageActionsConfigSchema>;

export const LanguageSwitcherConfigSchema = z.enum(["default", "minimal"]);
export type LanguageSwitcherConfig = z.infer<typeof LanguageSwitcherConfigSchema>;

export const ProductSwitcherConfigSchema = z.enum(["default", "toggle"]);
export type ProductSwitcherConfig = z.infer<typeof ProductSwitcherConfigSchema>;

export const DocsThemeConfigSchema = z.object({
    sidebar: DocsSidebarConfigSchema.nullish(),
    body: DocsBodyConfigSchema.nullish(),
    tabs: DocsTabsConfigSchema.nullish(),
    footerNav: FooterNavConfigSchema.nullish(),
    "page-actions": DocsPageActionsConfigSchema.nullish(),
    "language-switcher": LanguageSwitcherConfigSchema.nullish(),
    "product-switcher": ProductSwitcherConfigSchema.nullish()
});
export type DocsThemeConfig = z.infer<typeof DocsThemeConfigSchema>;

export const HttpSnippetLanguageSchema = z.enum([
    "curl",
    "csharp",
    "go",
    "java",
    "javascript",
    "php",
    "python",
    "ruby",
    "swift",
    "rust",
    "typescript"
]);
export type HttpSnippetLanguage = z.infer<typeof HttpSnippetLanguageSchema>;

export const HttpSnippetsConfigSchema = z.union([z.boolean(), z.array(HttpSnippetLanguageSchema)]);
export type HttpSnippetsConfig = z.infer<typeof HttpSnippetsConfigSchema>;

export const DocsSettingsConfigSchema = z.object({
    searchText: z.string().nullish(),
    disableSearch: z.boolean().nullish(),
    disableAnalytics: z.boolean().nullish(),
    darkModeCode: z.boolean().nullish(),
    defaultSearchFilters: z.boolean().nullish(),
    httpSnippets: HttpSnippetsConfigSchema.nullish(),
    hide404Page: z.boolean().nullish(),
    useJavascriptAsTypescript: z.boolean().nullish(),
    disableExplorerProxy: z.boolean().nullish(),
    language: LanguageSchema.nullish()
});
export type DocsSettingsConfig = z.infer<typeof DocsSettingsConfigSchema>;

export const TwitterCardSettingSchema = z.enum(["summary", "summary_large_image", "app", "player"]);
export type TwitterCardSetting = z.infer<typeof TwitterCardSettingSchema>;

export const MetadataConfigSchema = z.object({
    "og:site_name": z.string().nullish(),
    "og:title": z.string().nullish(),
    "og:description": z.string().nullish(),
    "og:url": z.string().nullish(),
    "og:image": FileIdOrUrlSchema.nullish(),
    "og:image:width": z.number().nullish(),
    "og:image:height": z.number().nullish(),
    "og:locale": z.string().nullish(),
    "og:logo": FileIdOrUrlSchema.nullish(),
    "twitter:title": z.string().nullish(),
    "twitter:description": z.string().nullish(),
    "twitter:handle": z.string().nullish(),
    "twitter:image": FileIdOrUrlSchema.nullish(),
    "twitter:site": z.string().nullish(),
    "twitter:url": z.string().nullish(),
    "twitter:card": TwitterCardSettingSchema.nullish(),
    noindex: z.boolean().nullish(),
    nofollow: z.boolean().nullish(),
    canonicalHost: z.string().nullish()
});
export type MetadataConfig = z.infer<typeof MetadataConfigSchema>;

export const RedirectConfigSchema = z.object({
    source: z.string(),
    destination: z.string(),
    permanent: z.boolean().nullish()
});
export type RedirectConfig = z.infer<typeof RedirectConfigSchema>;

export const WithPermissionsSchema = z.object({
    viewers: z.array(RoleIdSchema).nullish()
});
export type WithPermissions = z.infer<typeof WithPermissionsSchema>;

export const NavbarLinkMetadataSchema = z.object({
    ...WithPermissionsSchema.shape,
    url: UrlSchema,
    target: LinkTargetSchema.nullish(),
    text: z.string().nullish(),
    icon: z.string().nullish(),
    rightIcon: z.string().nullish(),
    rounded: z.boolean().nullish()
});
export type NavbarLinkMetadata = z.infer<typeof NavbarLinkMetadataSchema>;

export const NavbarGithubMetadataSchema = z.object({
    ...WithPermissionsSchema.shape,
    url: UrlSchema,
    target: LinkTargetSchema.nullish()
});
export type NavbarGithubMetadata = z.infer<typeof NavbarGithubMetadataSchema>;

export const NavbarLinkDropdownMetadataSchema = z.object({
    ...WithPermissionsSchema.shape,
    links: z.array(NavbarLinkMetadataSchema),
    text: z.string().nullish(),
    icon: z.string().nullish(),
    rightIcon: z.string().nullish(),
    rounded: z.boolean().nullish()
});
export type NavbarLinkDropdownMetadata = z.infer<typeof NavbarLinkDropdownMetadataSchema>;

export const NavbarLinkSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("filled"), ...NavbarLinkMetadataSchema.shape }),
    z.object({ type: z.literal("outlined"), ...NavbarLinkMetadataSchema.shape }),
    z.object({ type: z.literal("minimal"), ...NavbarLinkMetadataSchema.shape }),
    z.object({ type: z.literal("github"), ...NavbarGithubMetadataSchema.shape }),
    z.object({ type: z.literal("dropdown"), ...NavbarLinkDropdownMetadataSchema.shape }),
    z.object({ type: z.literal("primary"), ...NavbarLinkMetadataSchema.shape }),
    z.object({ type: z.literal("secondary"), ...NavbarLinkMetadataSchema.shape })
]);
export type NavbarLink = z.infer<typeof NavbarLinkSchema>;

export const FooterLinkSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("github"), value: UrlSchema }),
    z.object({ type: z.literal("twitter"), value: UrlSchema }),
    z.object({ type: z.literal("x"), value: UrlSchema }),
    z.object({ type: z.literal("linkedin"), value: UrlSchema }),
    z.object({ type: z.literal("youtube"), value: UrlSchema }),
    z.object({ type: z.literal("instagram"), value: UrlSchema }),
    z.object({ type: z.literal("facebook"), value: UrlSchema }),
    z.object({ type: z.literal("discord"), value: UrlSchema }),
    z.object({ type: z.literal("slack"), value: UrlSchema }),
    z.object({ type: z.literal("hackernews"), value: UrlSchema }),
    z.object({ type: z.literal("medium"), value: UrlSchema }),
    z.object({ type: z.literal("website"), value: UrlSchema })
]);
export type FooterLink = z.infer<typeof FooterLinkSchema>;

export const CssConfigSchema = z.object({
    inline: z.array(z.string()).nullish()
});
export type CssConfig = z.infer<typeof CssConfigSchema>;

export const JsScriptStrategySchema = z.enum(["beforeInteractive", "afterInteractive", "lazyOnload"]);
export type JsScriptStrategy = z.infer<typeof JsScriptStrategySchema>;

export const JsRemoteConfigSchema = z.object({
    url: UrlSchema,
    strategy: JsScriptStrategySchema.nullish()
});
export type JsRemoteConfig = z.infer<typeof JsRemoteConfigSchema>;

export const JsFileConfigSchema = z.object({
    fileId: FileIdSchema,
    strategy: JsScriptStrategySchema.nullish()
});
export type JsFileConfig = z.infer<typeof JsFileConfigSchema>;

export const JsConfigSchema = z.object({
    remote: z.array(JsRemoteConfigSchema).nullish(),
    files: z.array(JsFileConfigSchema),
    inline: z.array(z.string()).nullish()
});
export type JsConfig = z.infer<typeof JsConfigSchema>;

export const IntegrationsConfigSchema = z.object({
    intercom: z.string().nullish()
});
export type IntegrationsConfig = z.infer<typeof IntegrationsConfigSchema>;

export const FontStyleSchema = z.enum(["normal", "italic"]);
export type FontStyle = z.infer<typeof FontStyleSchema>;

export const FontDisplaySchema = z.enum(["auto", "block", "swap", "fallback", "optional"]);
export type FontDisplay = z.infer<typeof FontDisplaySchema>;

export const CustomFontConfigVariantSchema = z.object({
    fontFile: FileIdSchema,
    weight: z.array(z.string()).nullish(),
    style: z.array(FontStyleSchema).nullish()
});
export type CustomFontConfigVariant = z.infer<typeof CustomFontConfigVariantSchema>;

export const CustomFontConfigSchema = z.object({
    name: z.string(),
    variants: z.array(CustomFontConfigVariantSchema),
    display: FontDisplaySchema.nullish(),
    fallback: z.array(z.string()).nullish(),
    fontVariationSettings: z.string().nullish()
});
export type CustomFontConfig = z.infer<typeof CustomFontConfigSchema>;

export const FontConfigV2Schema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("custom"), ...CustomFontConfigSchema.shape })
]);
export type FontConfigV2 = z.infer<typeof FontConfigV2Schema>;

export const DocsTypographyConfigV2Schema = z.object({
    headingsFont: FontConfigV2Schema.nullish(),
    bodyFont: FontConfigV2Schema.nullish(),
    codeFont: FontConfigV2Schema.nullish()
});
export type DocsTypographyConfigV2 = z.infer<typeof DocsTypographyConfigV2Schema>;

export const ThemedFileIdSchema = z.object({
    dark: FileIdSchema.nullish(),
    light: FileIdSchema.nullish()
});
export type ThemedFileId = z.infer<typeof ThemedFileIdSchema>;

export const ColorsConfigSchema = z.object({
    accentPrimary: RgbaColorSchema.nullish()
});
export type ColorsConfig = z.infer<typeof ColorsConfigSchema>;

export const ColorUnthemedConfigSchema = z.object({
    color: RgbaColorSchema.nullish()
});
export type ColorUnthemedConfig = z.infer<typeof ColorUnthemedConfigSchema>;

export const ColorThemedConfigSchema = z.object({
    dark: RgbaColorSchema.nullish(),
    light: RgbaColorSchema.nullish()
});
export type ColorThemedConfig = z.infer<typeof ColorThemedConfigSchema>;

export const ColorConfigSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("unthemed"), ...ColorUnthemedConfigSchema.shape }),
    z.object({ type: z.literal("themed"), ...ColorThemedConfigSchema.shape })
]);
export type ColorConfig = z.infer<typeof ColorConfigSchema>;

export const ColorsConfigV2Schema = z.object({
    accentPrimary: ColorConfigSchema.nullish(),
    background: ColorConfigSchema.nullish()
});
export type ColorsConfigV2 = z.infer<typeof ColorsConfigV2Schema>;

export const FontConfigSchema = z.object({
    name: z.string(),
    fontFile: FileIdSchema
});
export type FontConfig = z.infer<typeof FontConfigSchema>;

export const DocsTypographyConfigSchema = z.object({
    headingsFont: FontConfigSchema.nullish(),
    bodyFont: FontConfigSchema.nullish(),
    codeFont: FontConfigSchema.nullish()
});
export type DocsTypographyConfig = z.infer<typeof DocsTypographyConfigSchema>;

export const EditThisPageLaunchSchema = z.enum(["github", "dashboard"]);
export type EditThisPageLaunch = z.infer<typeof EditThisPageLaunchSchema>;

export const AIChatLocationSchema = z.enum(["docs", "slack", "discord"]);
export type AIChatLocation = z.infer<typeof AIChatLocationSchema>;

export const AIChatWebsiteDatasourceSchema = z.object({
    url: z.string(),
    title: z.string().nullish()
});
export type AIChatWebsiteDatasource = z.infer<typeof AIChatWebsiteDatasourceSchema>;

export const AIChatDatasourceSchema = AIChatWebsiteDatasourceSchema;
export type AIChatDatasource = z.infer<typeof AIChatDatasourceSchema>;

export const AIModelSchema = z.enum(["claude-3.5", "claude-3.7", "claude-4", "command-a"]);
export type AIModel = z.infer<typeof AIModelSchema>;

export const AIChatConfigSchema = z.object({
    model: AIModelSchema.nullish(),
    systemPrompt: z.string().nullish(),
    location: z.array(AIChatLocationSchema).nullish(),
    datasources: z.array(AIChatDatasourceSchema).nullish()
});
export type AIChatConfig = z.infer<typeof AIChatConfigSchema>;

export const PageActionOptionSchema = z.enum([
    "copyPage",
    "viewAsMarkdown",
    "askAi",
    "openAi",
    "claude",
    "cursor",
    "vscode"
]);
export type PageActionOption = z.infer<typeof PageActionOptionSchema>;

export const CustomPageActionSchema = z.object({
    title: z.string(),
    subtitle: z.string().nullish(),
    url: z.string(),
    icon: z.string().nullish(),
    default: z.boolean().nullish()
});
export type CustomPageAction = z.infer<typeof CustomPageActionSchema>;

export const PageActionOptionsSchema = z.object({
    copyPage: z.boolean().nullish(),
    viewAsMarkdown: z.boolean().nullish(),
    askAi: z.boolean().nullish(),
    openAi: z.boolean().nullish(),
    claude: z.boolean().nullish(),
    cursor: z.boolean().nullish(),
    vscode: z.boolean().nullish(),
    custom: z.array(CustomPageActionSchema).nullish()
});
export type PageActionOptions = z.infer<typeof PageActionOptionsSchema>;

export const PageActionsConfigSchema = z.object({
    default: PageActionOptionSchema.nullish(),
    options: PageActionOptionsSchema.nullish()
});
export type PageActionsConfig = z.infer<typeof PageActionsConfigSchema>;

export const HeightSchema = z.number();
export type Height = z.infer<typeof HeightSchema>;

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

export const ApiSectionV2Schema = z.object({
    node: z.unknown()
});
export type ApiSectionV2 = z.infer<typeof ApiSectionV2Schema>;

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
