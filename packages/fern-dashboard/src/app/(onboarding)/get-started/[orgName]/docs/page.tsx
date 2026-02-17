import type { Json } from "@fern-platform/supabase";

import { getLatestOpenApiSpecByTeamId, getOpenApiSpecByCollectionId } from "@/app/services/postman/openapi-repository";

import { ApiSpecStepClient } from "./ApiSpecStepClient";
import { ensureOnboardingOrgAccess } from "./ensureOnboardingOrgAccess";

interface DocsOnboardingStep1PageProps {
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

export default async function DocsOnboardingStep1Page({ params, searchParams }: DocsOnboardingStep1PageProps) {
    const { orgName } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs`, resolvedSearchParams);

    const postmanSpec = await fetchPostmanOpenApiSpec(resolvedSearchParams);

    const postmanTeamId = resolvedSearchParams?.["postman-team-id"];

    return (
        <ApiSpecStepClient
            postmanOpenApiSpec={postmanSpec?.spec ?? null}
            postmanCollectionId={postmanSpec?.collectionId ?? null}
            postmanTeamId={typeof postmanTeamId === "string" ? postmanTeamId : null}
        />
    );
}
