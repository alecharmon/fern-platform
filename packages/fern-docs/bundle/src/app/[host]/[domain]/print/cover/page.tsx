import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { PRINT_COVER_PAGE_DATA_ATTR } from "@fern-api/docs-pdf";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import { FernLogo, FernLogoFill } from "@fern-docs/components/FernLogo";
import type { Metadata } from "next/types";
import { getFernToken } from "@/app/fern-token";
import { runAsyncSpan } from "@/server/tracing";
import { withLogo } from "@/server/withLogo";
import styles from "./print.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOGO_HEIGHT_MIN_PX = 64;
const LOGO_HEIGHT_MAX_PX = 96;
const LOGO_HEIGHT_DEFAULT_PX = 32;
const LOGO_HEIGHT_SCALE = 2;
const SUBTITLE_DEFAULT_TEXT = "Complete documentation for developers, technical teams, and partners.";

export default async function PrintCoverPage(props: {
    params: Promise<{ host: string; domain: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    let [{ host, domain }, searchParams] = await Promise.all([props.params, props.searchParams]);
    searchParams ??= {};
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const [{ basePath }, config, lang, files, logoUrls] = await Promise.all([
        loader.getMetadata(),
        loader.getConfig(),
        loader.getLanguage(),
        loader.getFiles(),
        loader.getLogoUrls()
    ]);

    const resolveFileSrc = createFileResolver(files);
    const logo = withLogo(config, resolveFileSrc, basePath, undefined, logoUrls);
    const logoSrc = logo.light?.src ?? logo.dark?.src;
    const logoHeight = Math.max(
        LOGO_HEIGHT_MIN_PX,
        Math.min(LOGO_HEIGHT_MAX_PX, (logo.height ?? LOGO_HEIGHT_DEFAULT_PX) * LOGO_HEIGHT_SCALE)
    );

    const exportDate = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    const coverTitleOverride = typeof searchParams.title === "string" ? searchParams.title : undefined;
    const coverSubtitleOverride = typeof searchParams.subtitle === "string" ? searchParams.subtitle : undefined;
    const hideFooter = searchParams.hideFooter === "1" || searchParams.hideFooter === "true";

    const coverTitleOverrideTrimmed = coverTitleOverride?.trim();
    const coverSubtitleOverrideTrimmed = coverSubtitleOverride?.trim();

    const shouldRenderTitle = coverTitleOverride == null || coverTitleOverrideTrimmed !== "";
    const shouldRenderSubtitle = coverSubtitleOverride == null || coverSubtitleOverrideTrimmed !== "";

    const coverTitle = coverTitleOverride == null ? config.title || domain : coverTitleOverrideTrimmed;
    const coverSubtitle = coverSubtitleOverride == null ? SUBTITLE_DEFAULT_TEXT : coverSubtitleOverrideTrimmed;

    return (
        <div
            {...{ [PRINT_COVER_PAGE_DATA_ATTR]: true }}
            data-fern-domain={domain}
            data-fern-base-path={basePath ?? "/"}
            lang={lang}
            className={`${styles.root} relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-white px-16 py-12 font-sans`}
        >
            {/* Subtle top gradient wash */}
            <div
                data-fern-cover-accent
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
                style={{
                    backgroundImage: "linear-gradient(180deg, rgba(0, 135, 0, 0.03) 0%, transparent 50%)"
                }}
            />

            <div data-fern-cover-content className="relative z-10 flex max-w-[600px] flex-col items-center text-center">
                <div
                    data-fern-cover-badge
                    className="mb-[46px] inline-flex items-center gap-2 rounded-full border px-[14px] py-[7px] text-[10px] font-[650] uppercase tracking-[0.14em] leading-none"
                    style={{ color: "#065f46", background: "#ecfdf5", borderColor: "#6ee7b7" }}
                >
                    Documentation
                </div>

                {logoSrc ? (
                    <div data-fern-cover-logo className="mb-14 flex items-center justify-center">
                        {/* biome-ignore lint: cover page uses <img> for print/PDF */}
                        <img
                            src={logoSrc}
                            alt={`${config.title ?? domain} logo`}
                            style={{ height: `${logoHeight}px` }}
                            className="block max-w-[400px] object-contain"
                        />
                    </div>
                ) : null}

                {shouldRenderTitle ? (
                    <h1
                        data-fern-cover-title
                        className={`mb-6 text-[58px] font-extrabold leading-[1.05] tracking-[-0.03em] ${styles.title}`}
                    >
                        {coverTitle}
                    </h1>
                ) : null}

                {shouldRenderSubtitle ? (
                    <div
                        data-fern-cover-subtitle
                        className={`mb-20 max-w-[500px] text-[18px] leading-[1.6] ${styles.subtitle}`}
                    >
                        {coverSubtitle}
                    </div>
                ) : null}

                <div data-fern-cover-meta className="mt-2">
                    <div data-fern-cover-date className={`text-[15px] font-normal tracking-[0.01em] ${styles.date}`}>
                        {exportDate}
                    </div>
                </div>
            </div>

            {hideFooter ? null : (
                <div
                    data-fern-cover-footer
                    className={`absolute bottom-[44px] right-[44px] z-10 flex justify-center text-[12px] ${styles.footer}`}
                >
                    <div data-fern-cover-footer-inner className="inline-flex items-center gap-1.5">
                        <span>Generated by</span>
                        <span
                            data-fern-cover-footer-brand
                            className={`inline-flex items-center gap-1.5 font-semibold tracking-[-0.005em] ${styles.footerBrand}`}
                        >
                            <FernLogo
                                fill={FernLogoFill.Ground}
                                style={{ height: 12, width: "auto", marginTop: -3.5 }}
                            />
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export async function generateMetadata(props: {
    params: Promise<{ host: string; domain: string }>;
}): Promise<Metadata> {
    return runAsyncSpan("route.print-cover.generateMetadata", async () => {
        const { domain } = await props.params;
        return {
            title: `Cover – ${domain}`,
            robots: { index: false, follow: false }
        };
    });
}
