import { createCachedDocsLoader } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { inferDocsStructure } from "@/components/pdf-exporter/infer-docs-structure";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { DocsUrl } from "@/utils/types";
import { HeaderActionsMenuClient } from "./HeaderActionsMenuClient";

type HeaderActionsMenuProps = {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    token: string;
};

export async function HeaderActionsMenu({ docsUrl, orgName, token }: HeaderActionsMenuProps) {
    const host = await getHostFromHeaders();
    let loader: DocsLoader | undefined;
    const rawDomain = docsUrl.split("/")[0];
    try {
        loader = await createCachedDocsLoader(host, rawDomain!, token, { skipAuth: true });
    } catch (error) {
        console.error("[HeaderActionsMenu] Failed to load docs", {
            cause: error instanceof Error ? error.message : String(error)
        });
        return null;
    }

    const [config, root] = await Promise.all([loader.getConfig(), loader.getRoot()]);

    const defaultCoverTitle = config.title || "Documentation";
    const docsStructure = inferDocsStructure(root);

    return (
        <HeaderActionsMenuClient
            docsUrl={docsUrl}
            orgName={orgName}
            defaultCoverTitle={defaultCoverTitle}
            docsStructure={docsStructure}
        />
    );
}
