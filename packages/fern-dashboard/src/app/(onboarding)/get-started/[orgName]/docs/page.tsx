import type { Json } from "@fern-platform/supabase";
import { RedirectType, redirect } from "next/navigation";

import { getLatestOpenApiSpecByTeamId, getOpenApiSpecByCollectionId } from "@/app/services/postman/openapi-repository";

import { ApiSpecStepClient } from "./ApiSpecStepClient";
import { ensureOnboardingOrgAccess } from "./ensureOnboardingOrgAccess";
import { serializeSearchParams } from "./serializeSearchParams";

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

/**
 * Returns true when the request originates from a Postman collection publish flow.
 * In that case the API spec step is redundant because the collection is already
 * available — the user should be sent straight to the details page.
 */
function isPostmanCollectionFlow(searchParams?: Record<string, string | string[] | undefined>): boolean {
    if (!searchParams) {
        return false;
    }
    const collectionId = searchParams["collection-id"];
    const teamId = searchParams["postman-team-id"];
    return (
        (typeof collectionId === "string" && collectionId.length > 0) ||
        (typeof teamId === "string" && teamId.length > 0)
    );
}

export default async function DocsOnboardingStep1Page({ params, searchParams }: DocsOnboardingStep1PageProps) {
    const { orgName } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    await ensureOnboardingOrgAccess(orgName, `/get-started/${orgName}/docs`, resolvedSearchParams);

    // Postman users already have a collection — skip the API spec step
    // and go straight to the details page where the spec is auto-uploaded.
    if (isPostmanCollectionFlow(resolvedSearchParams)) {
        const queryString = serializeSearchParams(resolvedSearchParams);
        const detailsUrl = `/get-started/${orgName}/docs/details${queryString.toString() ? `?${queryString.toString()}` : ""}`;
        redirect(detailsUrl, RedirectType.replace);
    }

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
