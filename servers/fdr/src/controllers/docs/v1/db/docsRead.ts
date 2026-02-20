import * as z from "zod";

import { FileIdSchema } from "./commons";
import { RgbaColorSchema } from "./docsCommons";

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
} from "../shared";
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
} from "../shared";

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
