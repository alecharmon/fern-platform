import { ApiSpecStepClient } from "./ApiSpecStepClient";
import { ensureOnboardingOrgAccess } from "./ensureOnboardingOrgAccess";

interface DocsOnboardingStep1PageProps {
    params: Promise<{
        orgName: string;
    }>;
}

export default async function DocsOnboardingStep1Page({ params }: DocsOnboardingStep1PageProps) {
    const { orgName } = await params;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs`);

    return <ApiSpecStepClient />;
}
