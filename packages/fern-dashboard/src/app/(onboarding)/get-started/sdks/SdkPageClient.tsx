"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { SlideLeftTransition } from "@/components/transitions/SlideLeftTransition";
import { Button } from "@/components/ui/button";
import { BookADemoContent } from "./BookADemoContent";

interface SdkPageClientProps {
    email?: string;
    name?: string;
}

export function SdkPageClient({ email, name }: SdkPageClientProps) {
    const posthog = usePostHog();

    useEffect(() => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_SDK_PAGE_VIEWED, {});
    }, [posthog]);

    const handleQuickstartClick = () => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_SDK_QUICKSTART_CLICKED, {});
    };

    return (
        <div className="flex flex-col gap-2 w-full overflow-y-auto h-full items-center justify-center">
            <SlideLeftTransition>
                <div className="flex flex-col gap-2 max-w-[400px] h-full pb-1">
                    <h1 className="text-2xl font-semibold">SDKs quickstart</h1>
                    <p className="text-sm text-muted-foreground mb-4">Get started in minutes.</p>
                    <Button asChild>
                        <Link
                            href="https://buildwithfern.com/learn/sdks/overview/quickstart"
                            target="_blank"
                            onClick={handleQuickstartClick}
                        >
                            View quickstart
                        </Link>
                    </Button>
                    <hr className="my-4 border-border" />
                    <h1 className="text-2xl font-semibold">Book a demo</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        Get a walkthrough from a Fern product specialist.
                    </p>
                    <BookADemoContent email={email} name={name} />
                </div>
            </SlideLeftTransition>
        </div>
    );
}
