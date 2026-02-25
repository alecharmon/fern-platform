import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { inferDocsStructure } from "@/components/pdf-exporter/infer-docs-structure";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";
import { HeaderActionsMenuClient } from "./HeaderActionsMenuClient";

type HeaderActionsMenuProps = {
    encodedDocsUrl: EncodedDocsUrl;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    token: string;
};

export async function HeaderActionsMenu({ encodedDocsUrl, docsUrl, orgName, token }: HeaderActionsMenuProps) {
    const host = await getHostFromHeaders();
    const loader = await getCachedEditableDocsLoader(host, encodedDocsUrl, token);
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
