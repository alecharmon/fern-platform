import Script from "next/script";
import { BackArrow } from "@/app/(onboarding)/get-started/BackArrow";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { SdkPageClient } from "./SdkPageClient";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    return (
        <>
            <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
            <BackArrow href="/get-started" />
            <SdkPageClient email={session.user.email ?? undefined} name={session.user.name ?? undefined} />
        </>
    );
}
