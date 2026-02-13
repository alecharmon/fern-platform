import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { CompleteStepClient } from "./CompleteStepClient";

interface DocsOnboardingCompletePageProps {
    params: Promise<{
        orgName: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DocsOnboardingCompletePage({ params, searchParams }: DocsOnboardingCompletePageProps) {
    const { orgName } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs/complete`, resolvedSearchParams);

    return <CompleteStepClient organizationId={orgName} />;
}
