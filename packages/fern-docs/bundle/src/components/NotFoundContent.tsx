import "server-only";

import GradientExclamation from "@fern-docs/components/GradientExclamation";
import { HiddenSidebar } from "@fern-docs/components/state/layout";

import { NotFound404Tracker } from "./analytics/NotFound404Tracker";
import ReturnHomeButton from "./ReturnHomeButton";

// todo: don't hide the sidebar if disable-header is true
export default async function NotFoundContent() {
    return (
        <>
            <NotFound404Tracker />
            <HiddenSidebar />
            <div className="flex h-[calc(100svh-var(--header-height)-6rem)] w-screen flex-col items-center justify-center gap-6">
                <GradientExclamation />
                <div className="flex flex-col text-center">
                    <h1>Page not found!</h1>
                    <p className="text-(color:--grayscale-a9)">
                        We&apos;re sorry, we couldn&apos;t find the page you were looking for.
                    </p>
                </div>

                <ReturnHomeButton />
            </div>
        </>
    );
}
