import * as z from "zod";

import type { PageId, Url } from "./db-commons";
import {
    ApiDefinitionIdSchema,
    AvailabilitySchema,
    FileIdSchema,
    PageIdSchema,
    UrlSchema,
    VersionIdSchema
} from "./db-commons";
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
} from "./db-docsCommons";
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
} from "./db-docsRead";

export const DbFileInfoSchema = z.object({
    s3Key: z.string()
});
export type DbFileInfo = z.infer<typeof DbFileInfoSchema>;

export const DbImageFileInfoSchema = z.object({
    s3Key: z.string(),
    width: z.number(),
    height: z.number(),
    blurDataUrl: z.string().optional(),
    alt: z.string().optional()
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
        icon: z.string().optional(),
        items: z.array(NavigationItemSchema),
        urlSlug: z.string(),
        skipUrlSlug: z.boolean().optional()
    })
);

export interface NavigationTabGroup {
    title: string;
    icon?: string;
    items: NavigationItem[];
    urlSlug: string;
    skipUrlSlug?: boolean;
}

export const NavigationTabSchema = z.union([NavigationTabGroupSchema, NavigationTabLinkSchema]);
export type NavigationTab = z.infer<typeof NavigationTabSchema>;

export const NavigationTabV2Schema: z.ZodType<NavigationTabV2> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("group"),
            title: z.string(),
            icon: z.string().optional(),
            items: z.array(NavigationItemSchema),
            urlSlug: z.string(),
            skipUrlSlug: z.boolean().optional()
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
        icon?: string;
        url: Url;
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

export const ApiSectionSchema = z.object({
    title: z.string(),
    icon: z.string().optional(),
    api: ApiDefinitionIdSchema,
    urlSlug: z.string(),
    skipUrlSlug: z.boolean(),
    artifacts: ApiArtifactsSchema.optional(),
    showErrors: z.boolean().optional(),
    changelog: ChangelogSectionSchema.optional(),
    hidden: z.boolean().optional(),
    fullSlug: z.array(z.string()).optional(),
    navigation: ApiNavigationConfigRootSchema.optional(),
    longScrolling: z.boolean().optional(),
    flattened: z.boolean().optional()
});
export type ApiSection = z.infer<typeof ApiSectionSchema>;

export type DocsSection = {
    title: string;
    icon?: string;
    items: NavigationItem[];
    urlSlug: string;
    skipUrlSlug: boolean;
    collapsed: boolean | "open-by-default";
    collapsible?: boolean;
    collapsedByDefault?: boolean;
    hidden?: boolean;
    fullSlug?: string[];
    overviewPageId?: PageId;
};

export const DocsSectionSchema: z.ZodType<DocsSection> = z.lazy(() =>
    z.object({
        title: z.string(),
        icon: z.string().optional(),
        items: z.array(NavigationItemSchema),
        urlSlug: z.string(),
        skipUrlSlug: z.boolean(),
        collapsed: z.union([z.boolean(), z.literal("open-by-default")]),
        collapsible: z.boolean().optional(),
        collapsedByDefault: z.boolean().optional(),
        hidden: z.boolean().optional(),
        fullSlug: z.array(z.string()).optional(),
        overviewPageId: PageIdSchema.optional()
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
    export interface Section extends DocsSection {
        type: "section";
    }
    export interface Link {
        type: "link";
        title: string;
        icon?: string;
        url: Url;
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
            icon: z.string().optional(),
            items: z.array(NavigationItemSchema),
            urlSlug: z.string(),
            skipUrlSlug: z.boolean(),
            collapsed: z.union([z.boolean(), z.literal("open-by-default")]),
            collapsible: z.boolean().optional(),
            collapsedByDefault: z.boolean().optional(),
            hidden: z.boolean().optional(),
            fullSlug: z.array(z.string()).optional(),
            overviewPageId: PageIdSchema.optional()
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
    urlSlug: z.string().optional(),
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

export const DocsDbConfigSchema = z.object({
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
    backgroundImage: FileIdSchema.optional(),
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
    logo: FileIdSchema.optional(),
    logoV2: ThemedFileIdSchema.optional(),
    colors: ColorsConfigSchema.optional(),
    colorsV2: ColorsConfigV2Schema.optional(),
    typography: DocsTypographyConfigSchema.optional()
});
export type DocsDbConfig = z.infer<typeof DocsDbConfigSchema>;

export const DocsDefinitionDbV1Schema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    referencedApis: z.array(ApiDefinitionIdSchema),
    files: z.record(FileIdSchema, DbFileInfoSchema),
    config: DocsDbConfigSchema,
    colors: ColorsConfigSchema.optional()
});
export type DocsDefinitionDbV1 = z.infer<typeof DocsDefinitionDbV1Schema>;

export const DocsDefinitionDbV2Schema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    referencedApis: z.array(ApiDefinitionIdSchema),
    files: z.record(FileIdSchema, DbFileInfoSchema),
    config: DocsDbConfigSchema,
    colors: ColorsConfigSchema.optional(),
    typography: DocsTypographyConfigSchema.optional()
});
export type DocsDefinitionDbV2 = z.infer<typeof DocsDefinitionDbV2Schema>;

export const DocsDefinitionDbV3Schema = z.object({
    pages: z.record(PageIdSchema, PageContentSchema),
    referencedApis: z.array(ApiDefinitionIdSchema),
    files: z.record(FileIdSchema, DbFileInfoV2Schema),
    config: DocsDbConfigSchema,
    jsFiles: z.record(z.string(), z.string()).optional()
});
export type DocsDefinitionDbV3 = z.infer<typeof DocsDefinitionDbV3Schema>;

export const DocsDefinitionDbSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("v1"), ...DocsDefinitionDbV1Schema.shape }),
    z.object({ type: z.literal("v2"), ...DocsDefinitionDbV2Schema.shape }),
    z.object({ type: z.literal("v3"), ...DocsDefinitionDbV3Schema.shape })
]);
export type DocsDefinitionDb = z.infer<typeof DocsDefinitionDbSchema>;

export namespace DocsDefinitionDb {
    export type V1 = DocsDefinitionDbV1 & { type: "v1" };
    export type V2 = DocsDefinitionDbV2 & { type: "v2" };
    export type V3 = DocsDefinitionDbV3 & { type: "v3" };
}

export * from "./db-commons";
export * from "./db-docsCommons";
export * from "./db-docsRead";
