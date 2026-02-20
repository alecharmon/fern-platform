import * as z from "zod";

import { FileIdSchema } from "./db-commons";
import { RgbaColorSchema } from "./db-docsCommons";

export type {
    ApiArtifacts,
    ApiNavigationConfigItem,
    ApiNavigationConfigRoot,
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
    PypiPackage
} from "./shared";
export {
    ApiArtifactsSchema,
    ApiNavigationConfigItemSchema,
    ApiNavigationConfigRootSchema,
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
    PypiPackageSchema
} from "./shared";

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
