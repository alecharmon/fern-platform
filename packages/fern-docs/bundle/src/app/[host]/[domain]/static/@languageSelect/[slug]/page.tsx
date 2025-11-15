import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { LanguageDropdown } from "@fern-docs/components/header/LanguageDropdown";

import { getFernToken } from "@/app/fern-token";

export const revalidate = false;

export default async function LanguageSelectPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const lang = await loader.getLanguage();

    // Get the node to extract the clean slug
    const root = await loader.getRoot();

    // remove language prefix from the slug
    const found = FernNavigation.utils.findNode(root, slugjoin(stripLanguagePrefix(slug)));

    const nodeSlug = found.type === "found" ? found.node.slug : slug;

    return <LanguageDropdown loader={loader} nodeSlug={nodeSlug} lang={lang} />;
}

function stripLanguagePrefix(slug: string) {
    // TODO: only strip if the first segment is a known language code
    if (slug.split("/")[0]?.match(/^[a-z]{2}$/)) {
        return slug.split("/").slice(1).join("/");
    }
    return slug;
}
