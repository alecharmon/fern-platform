import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { CodeWidgetPreview } from "../CodeWidgetPreview";
import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { DetailsStepClient } from "./DetailsStepClient";

interface DocsOnboardingStep3PageProps {
    params: Promise<{
        orgName: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DocsOnboardingStep3Page({ params, searchParams }: DocsOnboardingStep3PageProps) {
    const { orgName } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs/details`, resolvedSearchParams);

    const postmanCollectionId = resolvedSearchParams?.["collection-id"];
    const postmanTeamId = resolvedSearchParams?.["postman-team-id"];

    return (
        <>
            <BackArrow href={`/get-started/${orgName}/docs`} />
            <div className="flex justify-center gap-6">
                <DetailsStepClient
                    organizationId={orgName}
                    postmanCollectionId={typeof postmanCollectionId === "string" ? postmanCollectionId : null}
                    postmanTeamId={typeof postmanTeamId === "string" ? postmanTeamId : null}
                />
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
        </>
    );
}
