import { CodeWidgetPreview } from "../CodeWidgetPreview";
import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { PublishingStepClient } from "./PublishingStepClient";

interface DocsOnboardingPublishingPageProps {
    params: Promise<{
        orgName: string;
    }>;
}

export default async function DocsOnboardingPublishingPage({ params }: DocsOnboardingPublishingPageProps) {
    const { orgName } = await params;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs/publishing`);

    // Note: Additional client-side guards in PublishingStepClient
    // will check for valid sessionStorage data and redirect if missing
    return (
        <div className="flex justify-center gap-12">
            <PublishingStepClient organizationId={orgName} />
            <div
                className="max-w-[650px] max-h-[450px] hidden lg:block md:pt-12"
                style={{
                    maskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%), linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%), linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                    maskComposite: "intersect",
                    WebkitMaskComposite: "destination-in"
                }}
            >
                <CodeWidgetPreview />
            </div>
        </div>
    );
}
