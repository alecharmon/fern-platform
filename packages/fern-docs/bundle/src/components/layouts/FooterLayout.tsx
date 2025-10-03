import { AbstractFooterLayout } from "@fern-docs/components/layouts/AbstractFooterLayout";

import { BuiltWithFern } from "../built-with-fern";
import { Feedback } from "../feedback/Feedback";

export function FooterLayout({
    hideFeedback,
    hideNavLinks,
    editThisPageUrl,
    bottomNavigation,
    pathname,
    className
}: {
    hideFeedback?: boolean;
    hideNavLinks?: boolean;
    editThisPageUrl?: string;
    bottomNavigation?: React.ReactNode;
    pathname?: string;
    className?: string;
}) {
    return (
        <AbstractFooterLayout
            editThisPageUrl={editThisPageUrl}
            bottomNavigation={bottomNavigation}
            hideNavLinks={hideNavLinks}
            className={className}
            feedback={<div>{!hideFeedback && <Feedback pathname={pathname} />}</div>}
            builtWithFern={<BuiltWithFern className="mx-auto mt-12 w-fit" />}
        />
    );
}
