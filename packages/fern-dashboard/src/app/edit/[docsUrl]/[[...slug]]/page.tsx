import { constructEditorSlug, generateBranchName, ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDocsUrlMetadata } from "@/app/api/utils/getDocsUrlMetadata";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";

const EDIT_PREFIX = "/edit/";

/**
 * Resolves the domain from the raw URL path, preserving percent-encoding.
 * Next.js decodes %2F into / in route params, which breaks domains with basepaths
 * (e.g. buildwithfern.com%2Flearn). We read the raw path from the x-current-path
 * header set by middleware to preserve the encoding.
 */
async function resolvePreservedDomain(fallbackDomain: string): Promise<string> {
    const headersList = await headers();
    const rawPath = headersList.get("x-current-path");

    if (rawPath != null) {
        const pathOnly = rawPath.split("?")[0];
        if (pathOnly.startsWith(EDIT_PREFIX)) {
            const rawAfterEdit = pathOnly.slice(EDIT_PREFIX.length);

            // The first segment (up to the first unencoded /) is the encoded domain.
            // Encoded slashes (%2F) within the domain segment are preserved.
            const firstSlash = rawAfterEdit.indexOf("/");
            const rawDomain = firstSlash === -1 ? rawAfterEdit : rawAfterEdit.slice(0, firstSlash);

            return decodeURIComponent(rawDomain);
        }
    }

    return fallbackDomain;
}

interface EditDocsUrlPageProps {
    params: Promise<{ docsUrl: string; slug?: string[] }>;
}

export default async function EditDocsUrlPage({ params }: EditDocsUrlPageProps) {
    const { docsUrl, slug: slugSegments } = await params;

    const domain = await resolvePreservedDomain(docsUrl);
    const slug = slugSegments != null ? slugSegments.join("/") : "";

    // Ensure the user is logged in, redirecting to login with a return URL if not
    const session = await getCurrentSession();

    if (session == null) {
        await redirectToLogin();
    }

    // Look up the org that owns this docs URL using the user's access token
    const metadata = await getDocsUrlMetadata({ url: domain as DocsUrl, token: session.accessToken });

    if (!metadata.ok) {
        redirect("/error?message=Docs+site+not+found");
    }

    const orgName = Auth0OrgName(metadata.body.org);

    // Verify the user has access to the organization (checks membership via Venus API)
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Generate a new editor branch and redirect to the editor
    const branchName = generateBranchName(session.user.sub, session.user.name);

    const editorUrl = constructEditorSlug({
        orgName,
        docsUrl: encodeURIComponent(domain) as EncodedDocsUrl,
        branchName,
        slug: slug === "" ? ROOT_SLUG_ALIAS : slug
    });

    redirect(editorUrl);
}
