import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";

import { DocsZeroStateButtonClient } from "./DocsZeroStateButtonClient";

interface DocsZeroStateButtonProps {
    orgName: Auth0OrgName;
}

/**
 * Server Component that checks feature flags and renders the appropriate button
 */
export async function DocsZeroStateButton({ orgName }: DocsZeroStateButtonProps) {
    const session = await getCurrentSession();

    // Default to external link if no session
    if (session == null) {
        return <DocsZeroStateButtonClient useInternalWizard={false} />;
    }

    // Check feature flag server-side
    const isCreateDocsNewSiteEnabled = await isFeatureFlagEnabledForUser(
        PosthogFeatureFlag.ENABLE_CREATE_DOCS_NEW_SITE,
        session.user.sub,
        orgName
    );

    return <DocsZeroStateButtonClient useInternalWizard={!!isCreateDocsNewSiteEnabled} />;
}
