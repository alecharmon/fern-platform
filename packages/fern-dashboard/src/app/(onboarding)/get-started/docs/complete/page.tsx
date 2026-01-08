import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { CompleteStepClient } from "./CompleteStepClient";

export default async function DocsOnboardingCompletePage() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    return <CompleteStepClient />;
}
