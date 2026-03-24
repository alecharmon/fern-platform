import { oc } from "@orpc/contract";
import * as z from "zod";

export const SlugsInputSchema = z.object({
    domain: z.string(),
    basepath: z.string().optional().default("")
});

/** One entry per unique URL slug. lastUpdated is the latest lastUpdated of its markdown pages. */
export const SlugEntrySchema = z.object({
    orgId: z.string(),
    domain: z.string(),
    basepath: z.string(),
    slug: z.string(),
    lastUpdated: z.string()
});

/** One entry per markdown file tracked under a slug. */
export const MarkdownEntrySchema = z.object({
    orgId: z.string(),
    domain: z.string(),
    basepath: z.string(),
    pageId: z.string(),
    slug: z.string(),
    hash: z.string(),
    lastUpdated: z.string()
});

export const GetSlugEntriesResponseSchema = z.object({
    entries: z.array(SlugEntrySchema)
});

export const GetMarkdownEntriesResponseSchema = z.object({
    entries: z.array(MarkdownEntrySchema)
});

export type SlugsInput = z.infer<typeof SlugsInputSchema>;
export type SlugEntryResponse = z.infer<typeof SlugEntrySchema>;
export type MarkdownEntryResponse = z.infer<typeof MarkdownEntrySchema>;
export type GetSlugEntriesResponse = z.infer<typeof GetSlugEntriesResponseSchema>;
export type GetMarkdownEntriesResponse = z.infer<typeof GetMarkdownEntriesResponseSchema>;

export const slugsContract = {
    getSlugEntries: oc
        .route({ method: "POST", path: "/slugs" })
        .input(SlugsInputSchema)
        .output(GetSlugEntriesResponseSchema),
    getMarkdownEntries: oc
        .route({ method: "POST", path: "/markdowns" })
        .input(SlugsInputSchema)
        .output(GetMarkdownEntriesResponseSchema)
};
