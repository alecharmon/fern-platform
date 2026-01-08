import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { BackArrow } from "../../BackArrow";
import { ApiSpecStepClient } from "./ApiSpecStepClient";

export default async function DocsOnboardingStep2Page() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    return (
        <>
            <BackArrow href="/get-started/docs" />
            <ApiSpecStepClient />
        </>
    );
}
