import "server-only";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { NavbarSubItem } from "./NavbarSubItem";

export async function DocsNavbarSubItems({
    docsSites,
    orgName
}: {
    docsSites: FdrAPI.dashboard.DocsSite[];
    orgName: Auth0OrgName;
}) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    return (
        <>
            {docsSites.map((docsSite) => {
                const url = getDocsSiteUrl(docsSite);
                const docsUrlParam = constructDocsUrlParam(url);
                return (
                    <NavbarSubItem key={url} title={url} href={`/docs/${docsUrlParam}`} docsUrlParam={docsUrlParam} />
                );
            })}
        </>
    );
}
