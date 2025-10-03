import "server-only";

import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

export default async function DocsLayout({
    navbar,
    children,
    header,
    params
}: Readonly<{
    navbar: React.JSX.Element;
    children: React.JSX.Element;
    header: React.JSX.Element;
    params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}>) {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }
    const { orgName, docsUrl: encodedDocsUrl } = await params;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    // Validate that the docsUrl belongs to this organization so that we avoid errors in the page
    const response = await getDocsSitesForOrg({
        orgName,
        token: session.accessToken
    });
    if (!response.ok) {
        console.warn("Failed to get docs sites for org: ", JSON.stringify(response.error, null, 2));
        return notFound();
    }
    const docsSites = response.docsSites;

    const currentDocsSite = docsSites.find((site) => getDocsSiteUrl(site) === docsUrl);

    if (currentDocsSite == null) {
        if (docsSites.length === 0) {
            redirect(`/${orgName}/docs`);
        }
        return notFound();
    }
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            {header}
            <div className="flex flex-col gap-4">
                {navbar}
                <div className="flex">{children}</div>
            </div>
        </div>
    );
}
