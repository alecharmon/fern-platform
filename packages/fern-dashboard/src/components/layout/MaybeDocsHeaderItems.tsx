import "server-only";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import type { DocsUrl } from "@/utils/types";

import { DocsSiteSwitcher } from "./DocsSiteSwitcher";

export async function MaybeDocsHeaderItems({
    docsUrl,
    orgName
}: Readonly<{
    docsUrl?: DocsUrl;
    orgName?: Auth0OrgName;
}>) {
    if (orgName == null || docsUrl == null) {
        return null;
    }
    await getAuthenticatedSessionOrRedirect(orgName);
    return (
        <>
            <div className="flex items-center md:hidden">/</div>
            <div className="flex min-w-0 md:hidden">
                <DocsSiteSwitcher orgName={orgName} docsUrl={docsUrl} />
            </div>
        </>
    );
}
