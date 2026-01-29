import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { CompleteStepClient } from "./CompleteStepClient";

interface DocsOnboardingCompletePageProps {
    params: Promise<{
        orgName: string;
    }>;
}

export default async function DocsOnboardingCompletePage({ params }: DocsOnboardingCompletePageProps) {
    const { orgName } = await params;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs/complete`);

    return <CompleteStepClient organizationId={orgName} />;
}
