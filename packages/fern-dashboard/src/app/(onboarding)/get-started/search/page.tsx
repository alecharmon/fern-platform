import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { DocsZeroStateRequestOrgAccess } from "@/components/docs-page/DocsZeroStateRequestOrgAccess";
import { BackArrow } from "../BackArrow";

export default async function SearchForSitePage() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    return (
        <>
            <BackArrow href="/get-started" />
            <div className="flex w-full flex-1 flex-col max-w-[500px]">
                <h1 className="text-2xl font-bold">Find your Fern site</h1>
                <p className="text-md text-muted-foreground mt-2">
                    Enter your Fern docs site URL to request access to the Dashboard.
                </p>
                <div className="mt-8">
                    <DocsZeroStateRequestOrgAccess user={session.user} />
                </div>
            </div>
        </>
    );
}
