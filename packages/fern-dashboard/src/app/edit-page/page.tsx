import { constructEditorSlug, generateBranchName, ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";
import { redirect } from "next/navigation";
import getDocsUrlOwnerHandler from "@/app/api/get-docs-url-owner/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { GithubLoginButton, GoogleLoginButton } from "@/components/auth/LoginButton";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";

interface EditPageProps {
    searchParams: Promise<{
        docsUrl?: string;
        slug?: string;
    }>;
}

export default async function EditPage({ searchParams }: EditPageProps) {
    const { docsUrl, slug } = await searchParams;

    // Validate required params
    if (!docsUrl || slug == null) {
        redirect("/error?message=Missing+required+parameters:+docsUrl+and+slug");
    }

    // Check authentication
    const session = await getCurrentSession();
    if (session == null) {
        // Show login UI with returnTo back to this page
        const returnTo = `/edit-page?docsUrl=${encodeURIComponent(docsUrl)}&slug=${encodeURIComponent(slug)}`;
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border p-8 shadow-sm">
                    <h1 className="text-xl font-semibold">Sign in to edit</h1>
                    <p className="text-muted-foreground text-center text-sm">Please sign in to open the Fern editor.</p>
                    <div className="flex flex-col gap-2 w-full">
                        <GithubLoginButton returnTo={returnTo} />
                        <GoogleLoginButton returnTo={returnTo} />
                    </div>
                </div>
            </div>
        );
    }

    // Look up org from docsUrl
    let orgName: Auth0OrgName | undefined;
    try {
        const result = await getDocsUrlOwnerHandler({
            url: docsUrl as DocsUrl,
            token: session.accessToken
        });
        orgName = result.orgName;
    } catch (error) {
        console.error("[EditPage] Failed to get org for docsUrl:", docsUrl, error);
        redirect(`/error?message=${encodeURIComponent("Failed to find organization for this docs site")}`);
    }

    if (!orgName) {
        redirect(`/error?message=${encodeURIComponent("This docs site is not associated with a Fern organization")}`);
    }

    // Generate a new branch name for this session
    const branchName = generateBranchName(session.user.sub, session.user.name);

    // Construct the editor URL
    const editorUrl = constructEditorSlug({
        orgName,
        docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
        branchName,
        slug: slug === "" ? ROOT_SLUG_ALIAS : slug
    });

    // Redirect to the editor
    redirect(editorUrl);
}
