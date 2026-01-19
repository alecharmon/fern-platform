import { constructEditorSlug, generateBranchName, ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { doesUserBelongToOrg } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { GithubLoginButton, GoogleLoginButton } from "@/components/auth/LoginButton";
import { Button } from "@/components/ui/button";
import type { EncodedDocsUrl } from "@/utils/types";

interface EditPageProps {
    params: Promise<{ orgName: Auth0OrgName }>;
    searchParams: Promise<{
        docsUrl?: string;
        slug?: string;
        fallbackUrl?: string;
    }>;
}

export default async function EditPage({ params, searchParams }: EditPageProps) {
    const { orgName } = await params;
    const { docsUrl, slug, fallbackUrl } = await searchParams;

    // Validate required params
    if (!docsUrl || slug == null) {
        redirect("/error?message=Missing+required+parameters:+docsUrl+and+slug");
    }

    // Check authentication
    // Note: The [orgName]/layout.tsx handles org-scoped auth, but if the user
    // isn't logged in at all, we need to show the login UI here
    const session = await getCurrentSession();
    if (session == null) {
        // Show login UI with returnTo back to this page
        let returnTo = `/${orgName}/edit-page?docsUrl=${encodeURIComponent(docsUrl)}&slug=${encodeURIComponent(slug)}`;
        if (fallbackUrl) {
            returnTo += `&fallbackUrl=${encodeURIComponent(fallbackUrl)}`;
        }
        return (
            <div className="flex min-h-screen w-full items-center justify-center">
                <div className="mx-4 flex w-full max-w-md flex-col items-center gap-4 rounded-lg border bg-white p-8 shadow-sm sm:mx-auto">
                    <h1 className="text-xl font-semibold">Log in to Fern</h1>
                    <p className="text-muted-foreground text-center text-sm">
                        Please sign in to edit this page in Fern Editor.
                    </p>
                    <div className="flex w-full flex-col gap-2">
                        <GoogleLoginButton returnTo={returnTo} />
                        <GithubLoginButton returnTo={returnTo} />
                    </div>
                    {fallbackUrl && (
                        <>
                            <div className="flex w-full items-center gap-3">
                                <div className="h-px flex-1 bg-gray-900" />
                                <span className="text-sm text-gray-900">or</span>
                                <div className="h-px flex-1 bg-gray-900" />
                            </div>
                            <Button asChild className="w-full">
                                <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                                    <MagnifyingGlassIcon className="size-4" />
                                    View source on GitHub
                                </a>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Check if user is a member of this organization
    const isMember = await doesUserBelongToOrg(session.user.sub, orgName);
    if (!isMember) {
        // User is not a member - redirect to fallback URL (e.g., GitHub) or show error
        if (fallbackUrl) {
            redirect(fallbackUrl);
        }
        redirect(`/error?message=${encodeURIComponent("You don't have access to edit this documentation")}`);
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
