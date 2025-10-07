/* eslint-disable @typescript-eslint/no-invalid-void-type */

export const ROOT_SLUG_ALIAS = "root";

/** Recreated Auth0OrgName type for nominal typing */
export type Auth0OrgNameIsh = string & { __Auth0OrgName: void };

/** Recreated EncodedDocsUrl type for nominal typing */
export type EncodedDocsUrlIsh = string & { __encodedDocsUrl: void };

export function constructEditorSlug({
    orgName,
    docsUrl,
    branchName,
    slug,
    query
}: {
    orgName: Auth0OrgNameIsh;
    docsUrl: EncodedDocsUrlIsh;
    branchName: string;
    slug: string;
    query?: {
        clientPage?: boolean;
    };
}) {
    const baseUrl = `/${orgName}/editor/${docsUrl}/${branchName}/${slug}`;
    return query?.clientPage ? `${baseUrl}?client-page=true` : baseUrl;
}
