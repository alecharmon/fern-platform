import { ApiSpecStepClient } from "./ApiSpecStepClient";
import { ensureOnboardingOrgAccess } from "./ensureOnboardingOrgAccess";

interface DocsOnboardingStep1PageProps {
    params: {
        orgName: string;
    };
}

export default async function DocsOnboardingStep1Page({ params }: DocsOnboardingStep1PageProps) {
    await ensureOnboardingOrgAccess(params.orgName, `/get-started/${params.orgName}/docs`);

    return <ApiSpecStepClient />;
}
