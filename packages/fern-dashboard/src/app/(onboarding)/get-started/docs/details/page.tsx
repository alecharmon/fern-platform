import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { BackArrow } from "../../BackArrow";
import { DetailsStepClient } from "./DetailsStepClient";

export default async function DocsOnboardingStep3Page() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    // No organizationId for new onboarding flow - will be generated from docs URL during submission
    return (
        <>
            <BackArrow href="/get-started/docs/api-spec" />
            <DetailsStepClient />
        </>
    );
}
