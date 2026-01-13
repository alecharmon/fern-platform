import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { DocsZeroStateRequestOrgAccess } from "@/components/docs-page/DocsZeroStateRequestOrgAccess";
import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { BackArrow } from "../BackArrow";

export default async function SearchForSitePage() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    return (
        <>
            <BackArrow href="/get-started" />
            <SlideLeftTransition>
                <div className="flex w-full flex-col max-w-[400px]">
                    <h1 className="text-2xl font-bold">Find your Fern site</h1>
                    <p className="text-md text-muted-foreground mt-1 mb-6">
                        Enter your Fern docs site URL to request access to the Dashboard.
                    </p>

                    <DocsZeroStateRequestOrgAccess user={session.user} hideLabel />
                </div>
            </SlideLeftTransition>
        </>
    );
}
