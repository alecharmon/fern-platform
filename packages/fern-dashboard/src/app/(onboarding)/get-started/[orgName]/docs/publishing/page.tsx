import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { PublishingStepClient } from "./PublishingStepClient";

interface DocsOnboardingPublishingPageProps {
    params: {
        orgName: string;
    };
}

export default async function DocsOnboardingPublishingPage({ params }: DocsOnboardingPublishingPageProps) {
    await ensureOnboardingOrgAccess(params.orgName, `/get-started/${params.orgName}/docs/publishing`);

    // Note: Additional client-side guards in PublishingStepClient
    // will check for valid sessionStorage data and redirect if missing
    return <PublishingStepClient organizationId={params.orgName} />;
}
