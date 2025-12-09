import { AbstractFooterLayout } from "@fern-docs/components/layouts/AbstractFooterLayout";

import { BuiltWithFern } from "../built-with-fern";
import { Feedback } from "../feedback/Feedback";

export function FooterLayout({
    lang,
    hideFeedback,
    hideNavLinks,
    editThisPageUrl,
    bottomNavigation,
    pathname,
    className,
    lastUpdated
}: {
    lang: string;
    hideFeedback?: boolean;
    hideNavLinks?: boolean;
    editThisPageUrl?: string;
    bottomNavigation?: React.ReactNode;
    pathname?: string;
    className?: string;
    lastUpdated?: string;
}) {
    return (
        <AbstractFooterLayout
            lang={lang}
            editThisPageUrl={editThisPageUrl}
            bottomNavigation={bottomNavigation}
            hideNavLinks={hideNavLinks}
            className={className}
            feedback={<div>{!hideFeedback && <Feedback pathname={pathname} lang={lang} />}</div>}
            builtWithFern={<BuiltWithFern className="mx-auto mt-12 w-fit" lang={lang} />}
            lastUpdated={lastUpdated}
        />
    );
}
