import * as z from "zod";

import {
    ApiDefinitionIdSchema,
    AvailabilitySchema,
    FileIdSchema,
    PageIdSchema,
    UrlSchema,
    VersionIdSchema
} from "./commons";
import {
    AIChatConfigSchema,
    AnalyticsConfigSchema,
    AnnouncementConfigSchema,
    ColorsConfigSchema,
    ColorsConfigV2Schema,
    CssConfigSchema,
    DocsLayoutConfigSchema,
    DocsSettingsConfigSchema,
    DocsThemeConfigSchema,
    DocsTypographyConfigSchema,
    DocsTypographyConfigV2Schema,
    EditThisPageLaunchSchema,
    FooterLinkSchema,
    IntegrationsConfigSchema,
    JsConfigSchema,
    LanguageSchema,
    MetadataConfigSchema,
    NavbarLinkSchema,
    PageActionsConfigSchema,
    ProgrammingLanguageSchema,
    RedirectConfigSchema,
    ThemedFileIdSchema
} from "./docsCommons";
import {
    ApiArtifactsSchema,
    ApiNavigationConfigRootSchema,
    ApiSectionV2Schema,
    ChangelogSectionSchema,
    ChangelogSectionV3Schema,
    ColorsConfigV3Schema,
    HeightSchema,
    LinkMetadataSchema,
    NavigationTabLinkSchema,
    PageContentSchema,
    PageMetadataSchema
} from "./docsRead";

export const DbFileInfoSchema = z.object({
    s3Key: z.string()
});
export type DbFileInfo = z.infer<typeof DbFileInfoSchema>;

export const DbImageFileInfoSchema = z.object({
    s3Key: z.string(),
    width: z.number(),
    height: z.number(),
    blurDataUrl: z.string().nullish(),
    alt: z.string().nullish()
});
export type DbImageFileInfo = z.infer<typeof DbImageFileInfoSchema>;

export const DbFileInfoV2Schema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("s3Key"), ...DbFileInfoSchema.shape }),
    z.object({ type: z.literal("image"), ...DbImageFileInfoSchema.shape })
]);
export type DbFileInfoV2 = z.infer<typeof DbFileInfoV2Schema>;

export const NavigationTabGroupSchema: z.ZodType<NavigationTabGroup> = z.lazy(() =>
    z.object({
        title: z.string(),
        icon: z.string().nullish(),
        items: z.array(NavigationItemSchema),
        urlSlug: z.string(),
        skipUrlSlug: z.boolean().nullish()
    })
);

export interface NavigationTabGroup {
    title: string;
    icon?: string | null;
    items: NavigationItem[];
    urlSlug: string;
    skipUrlSlug?: boolean | null;
}

export const NavigationTabSchema = z.union([NavigationTabGroupSchema, NavigationTabLinkSchema]);
export type NavigationTab = z.infer<typeof NavigationTabSchema>;

export const NavigationTabV2Schema: z.ZodType<NavigationTabV2> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("group"),
            title: z.string(),
            icon: z.string().nullish(),
            items: z.array(NavigationItemSchema),
            urlSlug: z.string(),
            skipUrlSlug: z.boolean().nullish()
        }),
        z.object({ type: z.literal("link"), ...NavigationTabLinkSchema.shape }),
        z.object({ type: z.literal("changelog"), ...ChangelogSectionSchema.shape }),
        z.object({ type: z.literal("changelogV3"), ...ChangelogSectionV3Schema.shape })
    ])
) as z.ZodType<NavigationTabV2>;

export type NavigationTabV2 =
    | NavigationTabV2.Group
    | NavigationTabV2.Link
    | NavigationTabV2.Changelog
    | NavigationTabV2.ChangelogV3;

export namespace NavigationTabV2 {
    export interface Group extends NavigationTabGroup {
        type: "group";
    }
    export interface Link {
        type: "link";
        title: string;
        icon?: string | null;
        url: string;
        target?: string | null;
    }
    export interface Changelog {
        type: "changelog";
        icon?: string | null;
        hidden?: boolean | null;
        urlSlug: string;
        fullSlug?: string[] | null;
        title?: string | null;
        description?: string | null;
        pageId?: string | null;
        items: Array<{ date: string; pageId: string; tags?: string[] | null }>;
    }
    export interface ChangelogV3 {
        type: "changelogV3";
        node: unknown;
    }
}

export const ApiSectionSchema = z.object({
    title: z.string(),
    icon: z.string().nullish(),
    api: ApiDefinitionIdSchema,
    urlSlug: z.string(),
    skipUrlSlug: z.boolean(),
    artifacts: ApiArtifactsSchema.nullish(),
    showErrors: z.boolean().nullish(),
    changelog: ChangelogSectionSchema.nullish(),
    hidden: z.boolean().nullish(),
    fullSlug: z.array(z.string()).nullish(),
    navigation: ApiNavigationConfigRootSchema.nullish(),
    longScrolling: z.boolean().nullish(),
    flattened: z.boolean().nullish()
});
export type ApiSection = z.infer<typeof ApiSectionSchema>;

export type DocsSection = {
    title: string;
    icon?: string | null;
    items: NavigationItem[];
    urlSlug: string;
    skipUrlSlug: boolean;
    collapsed: boolean;
    collapsible?: boolean | null;
    collapsedByDefault?: boolean | null;
    hidden?: boolean | null;
    fullSlug?: string[] | null;
    overviewPageId?: string | null;
};

export const DocsSectionSchema: z.ZodType<DocsSection> = z.lazy(() =>
    z.object({
        title: z.string(),
        icon: z.string().nullish(),
        items: z.array(NavigationItemSchema),
        urlSlug: z.string(),
        skipUrlSlug: z.boolean(),
        collapsed: z.boolean(),
        collapsible: z.boolean().nullish(),
        collapsedByDefault: z.boolean().nullish(),
        hidden: z.boolean().nullish(),
        fullSlug: z.array(z.string()).nullish(),
        overviewPageId: PageIdSchema.nullish()
    })
);

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
        icon?: string | null;
        hidden?: boolean | null;
        urlSlug: string;
        fullSlug?: string[] | null;
        id: string;
        title: string;
    }
    export interface Api extends ApiSection {
        type: "api";
    }
    export interface ApiV2 {
        type: "apiV2";
        node: unknown;
    }
    export interface Section extends DocsSection {
        type: "section";
    }
    export interface Link {
        type: "link";
        title: string;
        icon?: string | null;
        url: string;
        target?: string | null;
    }
    export interface Changelog {
        type: "changelog";
        icon?: string | null;
        hidden?: boolean | null;
        urlSlug: string;
        fullSlug?: string[] | null;
        title?: string | null;
        description?: string | null;
        pageId?: string | null;
        items: Array<{ date: string; pageId: string; tags?: string[] | null }>;
    }
    export interface ChangelogV3 {
        type: "changelogV3";
        node: unknown;
    }
}

export const NavigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("page"),
            ...PageMetadataSchema.shape
        }),
        z.object({
            type: z.literal("api"),
            ...ApiSectionSchema.shape
        }),
        z.object({
            type: z.literal("apiV2"),
            ...ApiSectionV2Schema.shape
        }),
        z.object({
            type: z.literal("section"),
            title: z.string(),
            icon: z.string().nullish(),
            items: z.array(NavigationItemSchema),
            urlSlug: z.string(),
            skipUrlSlug: z.boolean(),
            collapsed: z.boolean(),
            collapsible: z.boolean().nullish(),
            collapsedByDefault: z.boolean().nullish(),
            hidden: z.boolean().nullish(),
            fullSlug: z.array(z.string()).nullish(),
            overviewPageId: PageIdSchema.nullish()
        }),
        z.object({
            type: z.literal("link"),
            ...LinkMetadataSchema.shape
        }),
        z.object({
            type: z.literal("changelog"),
            ...ChangelogSectionSchema.shape
        }),
        z.object({
            type: z.literal("changelogV3"),
            ...ChangelogSectionV3Schema.shape
        })
    ])
) as z.ZodType<NavigationItem>;

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
    urlSlug: z.string().nullish(),
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

export const DocsDbConfigSchema = z.object({
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
    backgroundImage: FileIdSchema.nullish(),
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
    logo: FileIdSchema.nullish(),
    logoV2: ThemedFileIdSchema.nullish(),
    colors: ColorsConfigSchema.nullish(),
    colorsV2: ColorsConfigV2Schema.nullish(),
    typography: DocsTypographyConfigSchema.nullish()
});
export type DocsDbConfig = z.infer<typeof DocsDbConfigSchema>;

export const DocsDefinitionDbV1Schema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    referencedApis: z.array(ApiDefinitionIdSchema),
    files: z.record(FileIdSchema, DbFileInfoSchema),
    config: DocsDbConfigSchema,
    colors: ColorsConfigSchema.nullish()
});
export type DocsDefinitionDbV1 = z.infer<typeof DocsDefinitionDbV1Schema>;

export const DocsDefinitionDbV2Schema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    referencedApis: z.array(ApiDefinitionIdSchema),
    files: z.record(FileIdSchema, DbFileInfoSchema),
    config: DocsDbConfigSchema,
    colors: ColorsConfigSchema.nullish(),
    typography: DocsTypographyConfigSchema.nullish()
});
export type DocsDefinitionDbV2 = z.infer<typeof DocsDefinitionDbV2Schema>;

export const DocsDefinitionDbV3Schema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    referencedApis: z.array(ApiDefinitionIdSchema),
    files: z.record(FileIdSchema, DbFileInfoV2Schema),
    config: DocsDbConfigSchema,
    jsFiles: z.record(z.string(), z.string()).nullish()
});
export type DocsDefinitionDbV3 = z.infer<typeof DocsDefinitionDbV3Schema>;

export const DocsDefinitionDbSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("v1"), ...DocsDefinitionDbV1Schema.shape }),
    z.object({ type: z.literal("v2"), ...DocsDefinitionDbV2Schema.shape }),
    z.object({ type: z.literal("v3"), ...DocsDefinitionDbV3Schema.shape })
]);
export type DocsDefinitionDb = z.infer<typeof DocsDefinitionDbSchema>;

export * from "./commons";
export * from "./docsCommons";
export * from "./docsRead";
