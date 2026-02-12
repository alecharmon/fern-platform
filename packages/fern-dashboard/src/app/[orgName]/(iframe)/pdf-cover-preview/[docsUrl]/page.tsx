import { PRINT_COVER_PAGE_DATA_ATTR } from "@fern-api/docs-pdf";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import { withLogo } from "@fern-api/docs-server/withLogo";
import { PdfCoverPage } from "@fern-docs/components/pdf/PdfCoverPage";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

import "./preview.css";

export const dynamic = "force-dynamic";

export default async function PdfCoverPreviewIframePage(props: {
    params: Promise<{ orgName: string; docsUrl: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const session = await getCurrentSession();
    if (session == null) {
        return <div className="p-4 text-sm text-muted-foreground">Authentication required</div>;
    }

    const [{ docsUrl }, searchParams, host] = await Promise.all([
        props.params,
        props.searchParams,
        getHostFromHeaders()
    ]);
    const sp = searchParams ?? {};

    // Load real docs configuration
    const loader = await getCachedEditableDocsLoader(host, docsUrl as EncodedDocsUrl, session.accessToken);
    const [metadata, config, files, lang] = await Promise.all([
        loader.getMetadata(),
        loader.getConfig(),
        loader.getFiles(),
        loader.getLanguage()
    ]);
    const resolveFileSrc = createFileResolver(files);

    const logo = withLogo(config, resolveFileSrc, metadata.basePath, undefined);
    const coverTitle = typeof sp.title === "string" ? sp.title : undefined;
    const coverSubtitle = typeof sp.subtitle === "string" ? sp.subtitle : undefined;
    const hideFooter = sp.hideFooter === "1" || sp.hideFooter === "true";

    return (
        <div id="pdf-cover-iframe">
            <PdfCoverPage
                domain={docsUrl}
                basePath={metadata.basePath}
                docsLanguage={lang}
                printCoverPageDataAttribute={PRINT_COVER_PAGE_DATA_ATTR}
                logoSrc={logo.light?.src ?? logo.dark?.src}
                logoHeight={logo.height}
                coverTitle={coverTitle}
                coverSubtitle={coverSubtitle}
                hideFooter={hideFooter}
            />
        </div>
    );
}
