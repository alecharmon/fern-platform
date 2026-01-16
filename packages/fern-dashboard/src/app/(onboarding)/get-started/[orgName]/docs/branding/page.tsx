import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { BrandingStepClient } from "./BrandingStepClient";

interface DocsOnboardingBrandingStepPageProps {
    params: {
        orgName: string;
    };
}

export default async function DocsOnboardingBrandingStepPage({ params }: DocsOnboardingBrandingStepPageProps) {
    await ensureOnboardingOrgAccess(params.orgName, `/get-started/${params.orgName}/docs/branding`);

    return (
        <>
            <BackArrow href={`/get-started/${params.orgName}/docs`} />
            <BrandingStepClient />
        </>
    );
}
