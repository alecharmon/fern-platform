import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { BrandingStepClient } from "./BrandingStepClient";

interface DocsOnboardingBrandingStepPageProps {
    params: Promise<{
        orgName: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DocsOnboardingBrandingStepPage({
    params,
    searchParams
}: DocsOnboardingBrandingStepPageProps) {
    const { orgName } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs/branding`, resolvedSearchParams);

    return (
        <>
            <BackArrow href={`/get-started/${orgName}/docs`} />
            <BrandingStepClient />
        </>
    );
}
