import Link from "next/link";

import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";

export default async function SearchForSitePage() {
    const session = await getCurrentSession();
    if (session == null) {
        await redirectToLogin();
    }

    return (
        <>
            <BackArrow href="/get-started" />
            <SlideLeftTransition>
                <div className="flex w-full flex-col max-w-[400px] px-7 lg:px-8">
                    <h1 className="text-2xl font-bold">Find your Fern site</h1>
                    <p className="text-md text-muted-foreground mt-1 mb-6">
                        Ask your admin for an invite to{" "}
                        <Link
                            href="https://buildwithfern.com/learn/dashboard/configuration/permissions#add-a-member"
                            className="fern-link"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            add you as a member.
                        </Link>
                    </p>
                </div>
            </SlideLeftTransition>
        </>
    );
}
