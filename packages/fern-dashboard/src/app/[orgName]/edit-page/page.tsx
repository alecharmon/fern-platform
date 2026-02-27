import { constructEditorSlug, generateBranchName, ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { doesUserBelongToOrg } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { GithubLogo } from "@/components/auth/GithubLogo";
import { FernIcon } from "@/components/theme/FernIcon";
import { Button } from "@/components/ui/button";
import type { EncodedDocsUrl } from "@/utils/types";
import { LoginFernButton } from "./LoginFernButton";
import { OpenFernButton } from "./OpenFernButton";

interface EditPageProps {
    params: Promise<{ orgName: Auth0OrgName }>;
    searchParams: Promise<{
        docsUrl?: string;
        slug?: string;
        fallbackUrl?: string;
        autoRedirect?: string;
    }>;
}

export default async function EditPage({ params, searchParams }: EditPageProps) {
    const { orgName } = await params;
    const { docsUrl, slug, fallbackUrl, autoRedirect } = await searchParams;

    if (!docsUrl || slug == null) {
        redirect("/error?message=Missing+required+parameters:+docsUrl+and+slug");
    }

    const session = await getCurrentSession();

    if (session == null) {
        let returnTo = `/${orgName}/edit-page?docsUrl=${encodeURIComponent(docsUrl)}&slug=${encodeURIComponent(slug)}&autoRedirect=true`;
        if (fallbackUrl) {
            returnTo += `&fallbackUrl=${encodeURIComponent(fallbackUrl)}`;
        }
        const loginUrl = `/login?redirect_on_login=${encodeURIComponent(returnTo)}`;

        return (
            <div className="flex min-h-screen w-full items-center justify-center">
                <div className="mx-4 flex w-full max-w-3xl flex-col gap-6 rounded-xl bg-background p-8 shadow-sm sm:mx-auto">
                    <h1 className="text-center text-2xl font-bold">Edit this page</h1>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
                            <FernIcon className="size-10" />
                            <div>
                                <h2 className="text-lg font-semibold">With Fern Editor</h2>
                                <p className="text-muted-foreground text-sm">
                                    Visually edit your pages in a web editor.
                                </p>
                            </div>
                            <LoginFernButton loginUrl={loginUrl} />
                            <p className="text-muted-foreground text-center text-sm italic">
                                Requires an editor seat in {orgName}.
                            </p>
                        </div>
                        {fallbackUrl && (
                            <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
                                <GithubLogo
                                    width={40}
                                    height={40}
                                    className="text-muted-foreground"
                                    strokeWidth={1.2}
                                />
                                <div>
                                    <h2 className="text-lg font-semibold">With GitHub</h2>
                                    <p className="text-muted-foreground text-sm">Edit the source markdown files.</p>
                                </div>
                                <Button asChild variant="outline" className="w-full">
                                    <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                                        Open in GitHub
                                    </a>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (autoRedirect === "true") {
        const isMember = await doesUserBelongToOrg(session.user.sub, orgName);

        if (!isMember) {
            redirect("/");
        }

        const branchName = generateBranchName(session.user.sub, session.user.name);
        const editorUrl = constructEditorSlug({
            orgName,
            docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
            branchName,
            slug: slug === "" ? ROOT_SLUG_ALIAS : slug
        });

        redirect(editorUrl);
    }

    return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <div className="mx-4 flex w-full max-w-3xl flex-col gap-6 rounded-xl bg-background p-8 shadow-sm sm:mx-auto">
                <h1 className="text-center text-2xl font-bold">Edit this page</h1>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
                        <FernIcon className="size-10" />
                        <div>
                            <h2 className="text-lg font-semibold">With Fern Editor</h2>
                            <p className="text-muted-foreground text-sm">Visually edit your pages in a web editor.</p>
                        </div>
                        <OpenFernButton orgName={orgName} docsUrl={docsUrl} slug={slug} />
                        <p className="text-muted-foreground text-center text-sm italic">
                            Requires an editor seat in {orgName}.
                        </p>
                    </div>
                    {fallbackUrl && (
                        <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
                            <GithubLogo width={40} height={40} className="text-muted-foreground" strokeWidth={1.2} />
                            <div>
                                <h2 className="text-lg font-semibold">With GitHub</h2>
                                <p className="text-muted-foreground text-sm">Edit the source markdown files.</p>
                            </div>
                            <Button asChild variant="outline" className="w-full">
                                <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                                    Open in GitHub
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
