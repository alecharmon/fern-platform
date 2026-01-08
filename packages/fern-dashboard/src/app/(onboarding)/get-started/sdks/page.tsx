import Script from "next/script";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { BackArrow } from "../BackArrow";
import { BookADemoContent } from "./BookADemoContent";

export default async function Page() {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    return (
        <>
            <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
            <BackArrow href="/get-started" />
            <SlideLeftTransition>
                <div className="flex h-full flex-col gap-2 max-w-[400px]">
                    <h1 className="text-2xl font-semibold">Book a demo</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        Get a walkthrough from a Fern product specialist.
                    </p>
                    <BookADemoContent email={session.user.email ?? undefined} name={session.user.name ?? undefined} />
                </div>
            </SlideLeftTransition>
        </>
    );
}
