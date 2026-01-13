import Link from "next/link";
import Script from "next/script";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { Button } from "@/components/ui/button";
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
            <div className="flex flex-col gap-2 w-full overflow-y-auto h-full items-center justify-center">
                <SlideLeftTransition>
                    <div className="flex flex-col gap-2 max-w-[400px] h-full pb-1">
                        <h1 className="text-2xl font-semibold">SDKs quickstart</h1>
                        <p className="text-sm text-muted-foreground mb-4">Get started in minutes.</p>
                        <Button asChild>
                            <Link href="https://buildwithfern.com/learn/sdks/overview/quickstart" target="_blank">
                                View quickstart
                            </Link>
                        </Button>
                        <hr className="my-4 border-border" />
                        <h1 className="text-2xl font-semibold">Book a demo</h1>
                        <p className="text-sm text-muted-foreground mb-6">
                            Get a walkthrough from a Fern product specialist.
                        </p>
                        <BookADemoContent
                            email={session.user.email ?? undefined}
                            name={session.user.name ?? undefined}
                        />
                    </div>
                </SlideLeftTransition>
            </div>
        </>
    );
}
