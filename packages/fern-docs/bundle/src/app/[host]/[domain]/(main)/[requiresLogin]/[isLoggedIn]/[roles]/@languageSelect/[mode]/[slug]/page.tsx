import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { LanguageDropdown } from "@fern-docs/components/header/LanguageDropdown";

export const revalidate = false;

export default async function LanguageSelectPage({
    params
}: {
    params: Promise<{
        host: string;
        domain: string;
        requiresLogin: string;
        isLoggedIn: string;
        roles: string;
        mode: string;
        slug: string;
    }>;
}) {
    const { host, domain, slug, ...authParams } = await params;
    const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);
    const loader = await createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin });
    const lang = await loader.getLanguage();
    const config = await loader.getConfig();
    const minimal = config.theme?.["language-switcher"] === "minimal";

    const root = await loader.getRoot();

    const found = FernNavigation.utils.findNode(root, slugjoin(stripLanguagePrefix(slug)));

    const nodeSlug = found.type === "found" ? found.node.slug : slug;

    return <LanguageDropdown loader={loader} nodeSlug={nodeSlug} lang={lang} minimal={minimal} />;
}

function stripLanguagePrefix(slug: string) {
    if (slug.split("/")[0]?.match(/^[a-z]{2}$/)) {
        return slug.split("/").slice(1).join("/");
    }
    return slug;
}
