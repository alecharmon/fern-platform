import type { Auth0OrgName } from "@/app/services/auth0/types";

import type { EncodedDocsUrl } from "./types";

export const ROOT_SLUG_ALIAS = "root";

export function constructEditorSlug({
    orgName,
    docsUrl,
    branchName,
    slug
}: {
    orgName: Auth0OrgName;
    docsUrl: EncodedDocsUrl;
    branchName: string;
    slug: string;
}) {
    return `/${orgName}/editor/${docsUrl}/${branchName}/${slug}`;
}
