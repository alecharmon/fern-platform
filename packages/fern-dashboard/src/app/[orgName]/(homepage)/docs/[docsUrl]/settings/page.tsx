import { redirect } from "next/navigation";

import { isFernEmployee } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { Settings } from "@/components/settings/Settings";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function Page({
    params
}: {
    params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}) {
    const { orgName, docsUrl: encodedDocsUrl } = await params;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    const session = await getAuthenticatedSessionOrRedirect(orgName);

    const isEmployee = await isFernEmployee(session.user.sub);
    if (!isEmployee) {
        redirect(`/${orgName}/docs/${docsUrl}`);
    }

    return <Settings docsUrl={docsUrl} hasFernEmail={isEmployee} orgName={orgName} />;
}
