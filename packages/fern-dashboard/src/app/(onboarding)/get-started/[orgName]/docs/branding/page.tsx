import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { BrandingStepClient } from "./BrandingStepClient";

interface DocsOnboardingBrandingStepPageProps {
    params: Promise<{
        orgName: string;
    }>;
}

export default async function DocsOnboardingBrandingStepPage({ params }: DocsOnboardingBrandingStepPageProps) {
    const { orgName } = await params;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs/branding`);

    return (
        <>
            <BackArrow href={`/get-started/${orgName}/docs`} />
            <BrandingStepClient />
        </>
    );
}
