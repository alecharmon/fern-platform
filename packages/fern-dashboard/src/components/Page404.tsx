import GradientExclamation from "@fern-docs/components/GradientExclamation";

import ReturnHomeButton from "./ReturnHomeButton";
import { LogoutButton } from "./auth/LogoutButton";

export default function NotFoundContent() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <div className="flex h-24 w-24 items-center justify-center">
                <GradientExclamation colors={["var(--gray-500)", "var(--gray-800)", "var(--gray-1000)"]} />
            </div>
            <div className="flex flex-col text-center">
                <div className="mb-2 text-2xl font-bold">Page not found!</div>
                <p className="text-(color:--gray-900) mb-8 text-sm">
                    We&apos;re sorry, we couldn&apos;t find the page you were looking for.
                </p>
            </div>

            <div className="flex gap-2">
                <LogoutButton />
                <ReturnHomeButton />
            </div>
        </div>
    );
}
