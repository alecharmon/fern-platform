import { permanentRedirect } from "next/navigation";

import { getCurrentSession } from "../../services/auth0/getCurrentSession";
import { redirectToLogin } from "../../services/auth0/redirectToLogin";
import type { Auth0OrgName } from "../../services/auth0/types";

export default async function Page({ params }: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const { orgName } = await params;
    const session = await getCurrentSession();
    if (session == null) {
        return await redirectToLogin();
    }

    permanentRedirect(`/${orgName}/docs`);
}
