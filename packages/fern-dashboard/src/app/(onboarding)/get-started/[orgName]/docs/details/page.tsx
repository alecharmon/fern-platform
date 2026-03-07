import type { Json } from "@fern-platform/supabase";

import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { getLatestOpenApiSpecByTeamId, getOpenApiSpecByCollectionId } from "@/app/services/postman/openapi-repository";

import { CodeWidgetPreview } from "../CodeWidgetPreview";
import { ensureOnboardingOrgAccess } from "../ensureOnboardingOrgAccess";
import { DetailsStepClient } from "./DetailsStepClient";

interface DocsOnboardingStep3PageProps {
    params: Promise<{
        orgName: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

async function fetchPostmanOpenApiSpec(
    searchParams?: Record<string, string | string[] | undefined>
): Promise<{ spec: Json; collectionId: string } | null> {
    if (!searchParams) {
        return null;
    }

    const collectionId = searchParams["collection-id"];
    const teamId = searchParams["postman-team-id"];

    try {
        if (typeof collectionId === "string" && collectionId) {
            const result = await getOpenApiSpecByCollectionId(collectionId);
            if (result) {
                return { spec: result.openapi_spec, collectionId: result.collection_id };
            }
        }

        if (typeof teamId === "string" && teamId) {
            const result = await getLatestOpenApiSpecByTeamId(teamId);
            if (result) {
                return { spec: result.openapi_spec, collectionId: result.collection_id };
            }
        }
    } catch (error) {
        console.error("[Onboarding] Failed to fetch Postman OpenAPI spec:", error);
    }

    return null;
}

export default async function DocsOnboardingStep3Page({ params, searchParams }: DocsOnboardingStep3PageProps) {
    const { orgName } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs/details`, resolvedSearchParams);

    const postmanCollectionId = resolvedSearchParams?.["collection-id"];
    const postmanTeamId = resolvedSearchParams?.["postman-team-id"];
    const postmanSpec = await fetchPostmanOpenApiSpec(resolvedSearchParams);

    return (
        <>
            <BackArrow href={`/get-started/${orgName}/docs`} />
            <div className="flex justify-center gap-6">
                <DetailsStepClient
                    organizationId={orgName}
                    postmanCollectionId={typeof postmanCollectionId === "string" ? postmanCollectionId : null}
                    postmanTeamId={typeof postmanTeamId === "string" ? postmanTeamId : null}
                    postmanOpenApiSpec={postmanSpec?.spec ?? null}
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
