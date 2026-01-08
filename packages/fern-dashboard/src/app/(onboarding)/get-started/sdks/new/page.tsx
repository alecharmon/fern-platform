import "server-only";

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { BackArrow } from "../../BackArrow";
import { CreateOrganizationContentClient } from "./CreateOrganizationContentClient";

export default async function NewOrganizationPage() {
    const session = await getCurrentSession();
    if (session == null || session.accessToken == null) {
        redirect("/");
    }

    return (
        <>
            <BackArrow href="/get-started/sdks" />
            <SlideLeftTransition>
                <div className="flex h-full flex-col gap-2 max-w-[400px]">
                    <h1 className="text-2xl font-semibold">Create new organization</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        Set up a new organization to manage your SDKs and documentation.
                    </p>

                    <CreateOrganizationContentClient accessToken={session.accessToken} />
                </div>
            </SlideLeftTransition>
        </>
    );
}
