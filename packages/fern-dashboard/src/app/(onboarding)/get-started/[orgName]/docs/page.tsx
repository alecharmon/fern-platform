import { ApiSpecStepClient } from "./ApiSpecStepClient";
import { ensureOnboardingOrgAccess } from "./ensureOnboardingOrgAccess";

interface DocsOnboardingStep1PageProps {
    params: Promise<{
        orgName: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DocsOnboardingStep1Page({ params, searchParams }: DocsOnboardingStep1PageProps) {
    const { orgName } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs`, resolvedSearchParams);

    return <ApiSpecStepClient />;
}
