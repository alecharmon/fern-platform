import type { PrismaClient } from "@prisma/client";

export interface UpsertMarkdownParams {
    orgId: string;
    domain: string;
    basepath: string;
    slug: string;
    pageId: string;
    hash: string;
}

/** One entry per unique URL slug. lastUpdated is derived from the latest related markdown page. */
export interface SlugEntry {
    orgId: string;
    domain: string;
    basepath: string;
    slug: string;
    lastUpdated: Date;
}

/** One entry per markdown file. orgId is joined from the parent slug row. */
export interface MarkdownEntry {
    orgId: string;
    domain: string;
    basepath: string;
    pageId: string;
    slug: string;
    hash: string;
    lastUpdated: Date;
}

/** Internal type for change detection. orgId is not stored here — join through slugEntry to get it. */
export interface MarkdownRaw {
    domain: string;
    basepath: string;
    slug: string;
    pageId: string;
    hash: string;
    lastUpdated: Date;
}

export interface SlugsDao {
    /** Upsert markdowns and their parent slugs in one operation. */
    upsertMarkdowns(entries: UpsertMarkdownParams[]): Promise<void>;

    /**
     * Return one entry per unique slug. lastUpdated reflects the latest markdown update
     * for that slug.
     */
    getSlugEntries(domain: string, basepath: string): Promise<SlugEntry[]>;

    /**
     * Return one entry per markdown, with orgId joined from the parent slug.
     */
    getMarkdownEntries(domain: string, basepath: string): Promise<MarkdownEntry[]>;

    /** Return raw markdown records (no join) for internal change-detection. */
    getMarkdowns(domain: string, basepath: string): Promise<MarkdownRaw[]>;

    /** Delete markdowns by pageId and clean up orphaned slugs. */
    deleteMarkdowns(domain: string, basepath: string, pageIds: string[]): Promise<number>;
}

export class SlugsDaoImpl implements SlugsDao {
    constructor(private readonly prisma: PrismaClient) {}

    public async upsertMarkdowns(entries: UpsertMarkdownParams[]): Promise<void> {
        if (entries.length === 0) {
            return;
        }

        // Group by slug so each slug row is upserted exactly once.
        const bySlug = new Map<string, UpsertMarkdownParams[]>();
        for (const entry of entries) {
            const group = bySlug.get(entry.slug);
            if (group != null) {
                group.push(entry);
            } else {
                bySlug.set(entry.slug, [entry]);
            }
        }

        const now = new Date();

        await this.prisma.$transaction(
            Array.from(bySlug.entries()).flatMap(([slug, pages]) => {
                const { orgId, domain, basepath } = pages[0]!;

                // Slug must be upserted before its pages to satisfy the FK.
                const slugOp = this.prisma.slug.upsert({
                    where: { domain_basepath_slug: { domain, basepath, slug } },
                    create: { orgId, domain, basepath, slug, lastUpdated: now },
                    update: { orgId, lastUpdated: now }
                });

                const pageOps = pages.map((page) =>
                    this.prisma.markdown.upsert({
                        where: { domain_basepath_slug_pageId: { domain, basepath, slug, pageId: page.pageId } },
                        create: { domain, basepath, slug, pageId: page.pageId, hash: page.hash },
                        update: { hash: page.hash }
                    })
                );

                return [slugOp, ...pageOps];
            })
        );
    }

    public async getSlugEntries(domain: string, basepath: string): Promise<SlugEntry[]> {
        const slugs = await this.prisma.slug.findMany({
            where: { domain, basepath },
            include: {
                markdowns: {
                    select: { lastUpdated: true },
                    orderBy: { lastUpdated: "desc" },
                    take: 1
                }
            }
        });

        return slugs.map((s) => ({
            orgId: s.orgId,
            domain: s.domain,
            basepath: s.basepath,
            slug: s.slug,
            // Derived from the latest markdown; falls back to the stored value if none yet.
            lastUpdated: s.markdowns[0]?.lastUpdated ?? s.lastUpdated
        }));
    }

    public async getMarkdownEntries(domain: string, basepath: string): Promise<MarkdownEntry[]> {
        const pages = await this.prisma.markdown.findMany({
            where: { domain, basepath },
            include: { slugEntry: { select: { orgId: true } } }
        });

        return pages.map((page) => ({
            orgId: page.slugEntry.orgId,
            domain: page.domain,
            basepath: page.basepath,
            pageId: page.pageId,
            slug: page.slug,
            hash: page.hash,
            lastUpdated: page.lastUpdated
        }));
    }

    public async getMarkdowns(domain: string, basepath: string): Promise<MarkdownRaw[]> {
        return this.prisma.markdown.findMany({
            where: { domain, basepath }
        });
    }

    public async deleteMarkdowns(domain: string, basepath: string, pageIds: string[]): Promise<number> {
        if (pageIds.length === 0) {
            return 0;
        }

        const pagesToDelete = await this.prisma.markdown.findMany({
            where: { domain, basepath, pageId: { in: pageIds } },
            select: { slug: true }
        });
        const affectedSlugs = [...new Set(pagesToDelete.map((p) => p.slug))];

        const result = await this.prisma.markdown.deleteMany({
            where: { domain, basepath, pageId: { in: pageIds } }
        });

        if (affectedSlugs.length > 0) {
            await this.prisma.slug.deleteMany({
                where: {
                    domain,
                    basepath,
                    slug: { in: affectedSlugs },
                    markdowns: { none: {} }
                }
            });
        }

        return result.count;
    }
}
