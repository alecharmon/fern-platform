import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { CompleteStepClient } from "./CompleteStepClient";

interface DocsOnboardingCompletePageProps {
    params: {
        orgName: string;
    };
}

export default async function DocsOnboardingCompletePage({ params }: DocsOnboardingCompletePageProps) {
    await ensureOnboardingOrgAccess(params.orgName, `/get-started/${params.orgName}/docs/complete`);

    return <CompleteStepClient organizationId={params.orgName} />;
}
