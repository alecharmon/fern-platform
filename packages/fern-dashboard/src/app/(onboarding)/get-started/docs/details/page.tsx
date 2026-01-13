import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { BackArrow } from "../../BackArrow";
import { CodeWidgetPreview } from "../CodeWidgetPreview";
import { DetailsStepClient } from "./DetailsStepClient";

export default async function DocsOnboardingStep3Page() {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    return (
        <>
            <BackArrow href="/get-started/docs/api-spec" />
            <div className="flex justify-center gap-6">
                <DetailsStepClient />
                <div
                    className="max-w-[650px] max-h-[450px] hidden lg:block md:pt-12"
                    style={{
                        maskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)"
                    }}
                >
                    <CodeWidgetPreview />
                </div>
            </div>
        </>
    );
}
