import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";

import { DocsZeroStateButtonClient } from "./DocsZeroStateButtonClient";

interface DocsZeroStateButtonProps {
    orgName: Auth0OrgName | undefined;
}

/**
 * Server Component that checks feature flags and renders the appropriate button
 */
export async function DocsZeroStateButton({ orgName }: DocsZeroStateButtonProps) {
    const session = await getCurrentSession();

    if (orgName == null) {
        return <DocsZeroStateButtonClient useInternalWizard={false} />;
    }

    // Default to external link if no session
    if (session == null) {
        return <DocsZeroStateButtonClient useInternalWizard={false} />;
    }

    return <DocsZeroStateButtonClient useInternalWizard={true} />;
}
