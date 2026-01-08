import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { PublishingStepClient } from "./PublishingStepClient";

export default async function DocsOnboardingPublishingPage() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    // Note: Additional client-side guards in PublishingStepClient
    // will check for valid sessionStorage data and redirect if missing
    return <PublishingStepClient />;
}
