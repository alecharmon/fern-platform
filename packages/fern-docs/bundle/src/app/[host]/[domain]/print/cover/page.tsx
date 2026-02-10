import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { PRINT_COVER_PAGE_DATA_ATTR } from "@fern-api/docs-pdf";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import { PdfCoverPage } from "@fern-docs/components/pdf/PdfCoverPage";
import type { Metadata } from "next/types";
import { getFernToken } from "@/app/fern-token";
import { runAsyncSpan } from "@/server/tracing";
import { withLogo } from "@/server/withLogo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrintCoverPage(props: {
    params: Promise<{ host: string; domain: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    let [{ host, domain }, searchParams] = await Promise.all([props.params, props.searchParams]);
    searchParams ??= {};
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const [metadata, config, lang, files, logoUrls] = await Promise.all([
        loader.getMetadata(),
        loader.getConfig(),
        loader.getLanguage(),
        loader.getFiles(),
        loader.getLogoUrls()
    ]);

    const resolveFileSrc = createFileResolver(files);
    const logo = withLogo(config, resolveFileSrc, metadata.basePath, undefined, logoUrls);

    return (
        <PdfCoverPage
            domain={domain}
            docsMetadata={metadata}
            docsConfig={config}
            docsLanguage={lang}
            printCoverPageDataAttribute={PRINT_COVER_PAGE_DATA_ATTR}
            logoSrc={logo.light?.src ?? logo.dark?.src}
            logoHeight={logo.height}
            coverTitleOverride={typeof searchParams.title === "string" ? searchParams.title : undefined}
            coverSubtitleOverride={typeof searchParams.subtitle === "string" ? searchParams.subtitle : undefined}
            hideFooter={searchParams.hideFooter === "1" || searchParams.hideFooter === "true"}
        />
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
