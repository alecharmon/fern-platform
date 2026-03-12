import { createCachedDocsLoader } from "@fern-api/docs-loader";
import type { FernColorTheme } from "@fern-api/docs-utils";
import { FERN_DOCS_ORIGINS } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import type { DocsV1Read } from "@fern-api/fdr-sdk/client/types";
import type { FileIdOrUrl } from "@fern-api/fdr-sdk/docs";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getFrontmatter, markdownToString } from "@fern-docs/mdx";
import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { createFindNode } from "@/server/find-node";

import type { OgTemplateData } from "./templates/types";
import { UniversalTemplate } from "./templates/universal";

const DEFAULT_ACCENT_COLOR = "rgb(108, 99, 255)";
const DEFAULT_BG_COLOR = "#0A0A0A";
const DEFAULT_TEXT_COLOR = "#ffffff";
const DARK_TEXT_COLOR = "#1a1a1a";

// Satori supports TTF, OTF, and WOFF — not WOFF2
const SATORI_SUPPORTED_EXTENSIONS = new Set(["ttf", "otf", "woff"]);

function resolveLogoSrc(logoUrls: { light?: { src: string }; dark?: { src: string } }): string | undefined {
    return logoUrls.dark?.src ?? logoUrls.light?.src;
}

function resolveColors(colors: { light?: FernColorTheme; dark?: FernColorTheme }): {
    accentColor: string;
    backgroundColor: string;
    textColor: string;
} {
    const isDark = colors.dark != null;
    const theme = colors.dark ?? colors.light;

    return {
        accentColor: theme?.accent ?? DEFAULT_ACCENT_COLOR,
        backgroundColor: theme?.background ?? DEFAULT_BG_COLOR,
        textColor: isDark ? DEFAULT_TEXT_COLOR : DARK_TEXT_COLOR
    };
}

function resolveBackgroundImageSrc(
    metadata: Record<string, unknown> | undefined,
    files: Record<string, { src: string }>
): string | undefined {
    const bgImage = metadata?.["og:background-image"] as FileIdOrUrl | undefined;
    if (bgImage == null) {
        return undefined;
    }
    if (bgImage.type === "url") {
        return bgImage.value;
    }
    if (bgImage.type === "fileId") {
        return files[bgImage.value]?.src;
    }
    return undefined;
}

type SatoriFont = {
    name: string;
    data: ArrayBuffer;
    weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    style?: "normal" | "italic";
};

function getFontExtension(url: string): string | undefined {
    try {
        return new URL(url).pathname.split(".").pop()?.toLowerCase();
    } catch {
        return undefined;
    }
}

function parseWeight(weight: string[] | undefined): SatoriFont["weight"] | undefined {
    if (weight == null || weight.length === 0) {
        return undefined;
    }
    // Take the first explicit weight; for variable fonts ("100 900"), default to 400
    const raw = weight[0];
    if (raw == null) {
        return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
        return undefined;
    }
    return parsed as SatoriFont["weight"];
}

async function resolveFonts(
    typography: DocsV1Read.DocsConfig["typographyV2"],
    files: Record<string, { src: string }>,
    domain: string
): Promise<SatoriFont[]> {
    const fonts: SatoriFont[] = [];

    const fontsToLoad: Array<{
        name: string;
        variant: DocsV1Read.CustomFontConfigVariant;
        targetWeight: SatoriFont["weight"];
    }> = [];

    // Headings font for the title (rendered at weight 700)
    if (typography?.headingsFont?.variants?.length) {
        fontsToLoad.push({
            name: typography.headingsFont.name,
            variant: typography.headingsFont.variants[0]!,
            targetWeight: 700
        });
    }

    // Body font for the domain text (rendered at weight 500)
    if (typography?.bodyFont?.variants?.length) {
        fontsToLoad.push({
            name: typography.bodyFont.name,
            variant: typography.bodyFont.variants[0]!,
            targetWeight: 400
        });
    }

    await Promise.all(
        fontsToLoad.map(async ({ name, variant, targetWeight }) => {
            try {
                const src = files[variant.fontFile]?.src;
                if (src == null) {
                    return;
                }

                const ext = getFontExtension(src);
                if (ext == null || !SATORI_SUPPORTED_EXTENSIONS.has(ext)) {
                    logger.warn(`[og:${domain}] Skipping font "${name}" — unsupported format: ${ext}`);
                    return;
                }

                const response = await fetch(src);
                if (!response.ok) {
                    logger.warn(`[og:${domain}] Failed to fetch font "${name}": ${response.status}`);
                    return;
                }

                const data = await response.arrayBuffer();
                fonts.push({
                    name,
                    data,
                    weight: parseWeight(variant.weight) ?? targetWeight,
                    style: (variant.style?.[0] as SatoriFont["style"]) ?? "normal"
                });
            } catch (err) {
                logger.warn(`[og:${domain}] Error loading font "${name}":`, err);
            }
        })
    );

    return fonts;
}

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<Response> {
    let domain = "unknown";

    try {
        const { host, domain: d } = await props.params;
        domain = d;
        // Strip hash fragments — OG images are per-page, not per-anchor
        const slug = (req.nextUrl.searchParams.get("slug") ?? "").split("#")[0];

        logger.debug(`[og:${domain}] Generating OG image for slug: ${slug}`);

        const loader = await createCachedDocsLoader(host, domain, undefined, { skipAuth: true });

        const [config, files, colors, logoUrls, metadata] = await Promise.all([
            loader.getConfig(),
            loader.getFiles(),
            loader.getColors(),
            loader.getLogoUrls(),
            loader.getMetadata()
        ]);

        logger.debug(`[og:${domain}] Config loaded, title: ${config.title}`);

        // Resolve page title
        const findNode = createFindNode(loader);
        const node = await findNode(slugjoin(slug));

        let title: string = config.title ?? "Documentation";

        if (node != null) {
            const pageId = FernNavigation.getPageId(node);
            const page = pageId ? await loader.getPage(pageId) : undefined;
            const frontmatter = page ? getFrontmatter(page.markdown)?.data : undefined;

            const resolvedTitle = markdownToString(frontmatter?.headline || frontmatter?.title || node.title);
            title = resolvedTitle ?? node.title ?? title;
        }

        logger.debug(`[og:${domain}] Resolved title: ${title}`);

        // Resolve visual properties
        const logoSrc = resolveLogoSrc(logoUrls);
        const { accentColor, backgroundColor, textColor } = resolveColors(colors);
        const backgroundImageSrc = resolveBackgroundImageSrc(
            config.metadata as Record<string, unknown> | undefined,
            files
        );

        const templateData: OgTemplateData = {
            title: typeof title === "string" ? title : String(title),
            domain: metadata.basePath ? `${loader.domain}${metadata.basePath}` : loader.domain,
            logoSrc,
            accentColor,
            backgroundColor,
            backgroundImageSrc,
            textColor
        };

        // Resolve custom fonts from the site's typography config
        const fonts = await resolveFonts(config.typographyV2, files, domain);

        // Map font names to template
        const headingFontFamily = config.typographyV2?.headingsFont?.name;
        const bodyFontFamily = config.typographyV2?.bodyFont?.name;
        if (headingFontFamily || bodyFontFamily) {
            templateData.headingFontFamily = headingFontFamily;
            templateData.bodyFontFamily = bodyFontFamily;
        }

        logger.debug(`[og:${domain}] Rendering template with ${fonts.length} custom font(s)...`);

        const isFernDocsOrigin = FERN_DOCS_ORIGINS.includes(host);
        const isLocalhost = host === "localhost:3000";
        const cacheControl =
            isFernDocsOrigin || isLocalhost
                ? "no-cache, no-store, must-revalidate"
                : "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

        const response = new ImageResponse(UniversalTemplate(templateData), {
            width: 1200,
            height: 630,
            ...(fonts.length > 0 ? { fonts } : {})
        });

        // Set cache headers on the response
        response.headers.set("Cache-Control", cacheControl);

        logger.debug(`[og:${domain}] OG image generated successfully`);
        return response;
    } catch (error) {
        logger.error(`[og:${domain}] Error generating OG image:`, error);
        return NextResponse.json(
            {
                error: "Failed to generate OG image",
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
