import * as z from "zod";

import { FileIdOrUrlSchema } from "./shared";

export type { FileIdOrUrl } from "./shared";
export { FileIdOrUrlSchema } from "./shared";

export const StringOrStringListSchema = z.union([z.string(), z.array(z.string())]);
export type StringOrStringList = z.infer<typeof StringOrStringListSchema>;

export const TwitterCardSettingSchema = z.enum(["summary", "summary_large_image", "app", "player"]);
export type TwitterCardSetting = z.infer<typeof TwitterCardSettingSchema>;

export const JsonLdBreadcrumbListElementSchema = z.object({
    "@type": z.literal("ListItem"),
    position: z.number(),
    name: z.string(),
    item: z.string().optional()
});
export type JsonLdBreadcrumbListElement = z.infer<typeof JsonLdBreadcrumbListElementSchema>;

export const JsonLdBreadcrumbListSchema = z.object({
    "@context": z.literal("https://schema.org"),
    "@type": z.literal("BreadcrumbList"),
    itemListElement: z.array(JsonLdBreadcrumbListElementSchema)
});
export type JsonLdBreadcrumbList = z.infer<typeof JsonLdBreadcrumbListSchema>;

export const WithJsonLdBreadcrumbsSchema = z.object({
    "jsonld:breadcrumb": JsonLdBreadcrumbListSchema.optional()
});
export type WithJsonLdBreadcrumbs = z.infer<typeof WithJsonLdBreadcrumbsSchema>;

export const WithMetadataConfigSchema = z.object({
    "og:site_name": z.string().optional(),
    "og:title": z.string().optional(),
    "og:description": z.string().optional(),
    "og:url": z.string().optional(),
    "og:image": FileIdOrUrlSchema.optional(),
    "og:image:width": z.number().optional(),
    "og:image:height": z.number().optional(),
    "og:locale": z.string().optional(),
    "og:logo": FileIdOrUrlSchema.optional(),
    "twitter:title": z.string().optional(),
    "twitter:description": z.string().optional(),
    "twitter:handle": z.string().optional(),
    "twitter:image": FileIdOrUrlSchema.optional(),
    "twitter:site": z.string().optional(),
    "twitter:url": z.string().optional(),
    "twitter:card": TwitterCardSettingSchema.optional(),
    noindex: z.boolean().optional(),
    nofollow: z.boolean().optional(),
    keywords: StringOrStringListSchema.optional()
});
export type WithMetadataConfig = z.infer<typeof WithMetadataConfigSchema>;

export const LayoutSchema = z.enum(["guide", "overview", "reference", "page", "custom"]);
export type Layout = z.infer<typeof LayoutSchema>;

export const LogoConfigurationSchema = z.object({
    light: FileIdOrUrlSchema.optional(),
    dark: FileIdOrUrlSchema.optional()
});
export type LogoConfiguration = z.infer<typeof LogoConfigurationSchema>;

export const LogoSchema = z.union([FileIdOrUrlSchema, LogoConfigurationSchema]);
export type Logo = z.infer<typeof LogoSchema>;

export const BreadcrumbItemSchema = z.object({
    title: z.string(),
    pointsTo: z.string().optional()
});
export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;

export const FrontmatterSchema = WithMetadataConfigSchema.merge(WithJsonLdBreadcrumbsSchema).merge(
    z.object({
        layout: LayoutSchema.optional(),
        slug: z.string().optional(),
        title: z.string().optional(),
        headline: z.string().optional(),
        description: z.string().optional(),
        subtitle: z.string().optional(),
        logo: LogoSchema.optional(),
        image: FileIdOrUrlSchema.optional(),
        "edit-this-page-url": z.string().optional(),
        "hide-toc": z.boolean().optional(),
        "force-toc": z.boolean().optional(),
        "hide-nav-links": z.boolean().optional(),
        "max-toc-depth": z.number().optional(),
        "hide-feedback": z.boolean().optional(),
        "hide-page-actions": z.boolean().optional(),
        "no-image-zoom": z.boolean().optional(),
        breadcrumb: z.array(BreadcrumbItemSchema).optional(),
        excerpt: z.string().optional(),
        "canonical-url": z.string().optional(),
        tags: StringOrStringListSchema.optional(),
        "last-updated": z.string().optional()
    })
);
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export const ResolvedMdxSchema = z.object({
    code: z.string(),
    frontmatter: FrontmatterSchema,
    scope: z.record(z.string(), z.unknown()),
    jsxRefs: z.array(z.string()).optional()
});
export type ResolvedMdx = z.infer<typeof ResolvedMdxSchema>;
