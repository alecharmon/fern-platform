import type { Json } from "@fern-platform/supabase";

import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { fetchPostmanCollection } from "@/app/services/postman/api";
import { getPostmanAccessToken } from "@/app/services/postman/jwt";
import { getLatestOpenApiSpecByTeamId, getOpenApiSpecByCollectionId } from "@/app/services/postman/openapi-repository";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";

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
                return {
                    spec: result.openapi_spec,
                    collectionId: result.collection_id
                };
            }
        }

        if (typeof teamId === "string" && teamId) {
            const result = await getLatestOpenApiSpecByTeamId(teamId);
            if (result) {
                return {
                    spec: result.openapi_spec,
                    collectionId: result.collection_id
                };
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
    const isPostmanFlow =
        (typeof postmanCollectionId === "string" && postmanCollectionId.length > 0) ||
        (typeof postmanTeamId === "string" && postmanTeamId.length > 0);

    const postmanSpec = await fetchPostmanOpenApiSpec(resolvedSearchParams);

    let postmanCollectionName: string | null = null;
    if (typeof postmanTeamId === "string" && typeof postmanCollectionId === "string") {
        try {
            const installation = await getAppInstallationByTeamId(postmanTeamId);
            if (installation) {
                const accessToken = await getPostmanAccessToken({
                    teamId: installation.team_id,
                    installationAuthId: installation.app_installation_id,
                    sharedSecret: installation.shared_secret
                });
                const collection = await fetchPostmanCollection(accessToken, postmanCollectionId);
                const info = collection.info;
                if (info != null && typeof info === "object" && "name" in info) {
                    const name = (info as Record<string, unknown>).name;
                    postmanCollectionName = typeof name === "string" ? name : null;
                }
            }
        } catch (error) {
            console.error("[Onboarding] Failed to fetch Postman collection name:", error);
        }
    }

    return (
        <>
            <BackArrow href={isPostmanFlow ? "/get-started" : `/get-started/${orgName}/docs`} />
            <div className="flex justify-center gap-6">
                <DetailsStepClient
                    organizationId={orgName}
                    postmanCollectionId={typeof postmanCollectionId === "string" ? postmanCollectionId : null}
                    postmanCollectionName={postmanCollectionName}
                    postmanTeamId={typeof postmanTeamId === "string" ? postmanTeamId : null}
                    postmanOpenApiSpec={postmanSpec?.spec ?? null}
                />
                <div
                    className="hidden max-h-[450px] max-w-[650px] md:pt-12 lg:block"
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
