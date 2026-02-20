import * as z from "zod";

import {
    EndpointIdSchema,
    FileIdSchema,
    LinkTargetSchema,
    PageIdSchema,
    SubpackageIdSchema,
    UrlSchema,
    WebhookIdSchema,
    WebSocketIdSchema
} from "./commons";
import { EditThisPageLaunchSchema, RgbaColorSchema } from "./docsCommons";

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

export const NavigationTabLinkSchema = z.object({
    title: z.string(),
    icon: z.string().nullish(),
    url: UrlSchema,
    target: LinkTargetSchema.nullish()
});
export type NavigationTabLink = z.infer<typeof NavigationTabLinkSchema>;

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

export const BackgroundSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("solid"), ...RgbaColorSchema.shape }),
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
