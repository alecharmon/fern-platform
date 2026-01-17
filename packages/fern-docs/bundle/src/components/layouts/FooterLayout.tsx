import { AbstractFooterLayout } from "@fern-docs/components/layouts/AbstractFooterLayout";

import { BuiltWithFern } from "../built-with-fern";
import { Feedback } from "../feedback/Feedback";

export function FooterLayout({
    lang,
    hideFeedback,
    hideNavLinks,
    editThisPageUrl,
    editThisPageLaunch,
    docsUrl,
    slug,
    orgName,
    bottomNavigation,
    pathname,
    className,
    footerLinks,
    hasMultipleLanguages,
    lastUpdated
}: {
    lang: string;
    hideFeedback?: boolean;
    hideNavLinks?: boolean;
    editThisPageUrl?: string;
    editThisPageLaunch?: "github" | "dashboard";
    docsUrl?: string;
    slug?: string;
    orgName?: string;
    bottomNavigation?: React.ReactNode;
    pathname?: string;
    className?: string;
    footerLinks?: React.ReactNode;
    hasMultipleLanguages?: boolean;
    lastUpdated?: string;
}) {
    return (
        <AbstractFooterLayout
            lang={lang}
            editThisPageUrl={editThisPageUrl}
            editThisPageLaunch={editThisPageLaunch}
            docsUrl={docsUrl}
            slug={slug}
            orgName={orgName}
            bottomNavigation={bottomNavigation}
            hideNavLinks={hideNavLinks}
            className={className}
            feedback={
                <div>
                    {!hideFeedback && (
                        <Feedback pathname={pathname} lang={lang} hasMultipleLanguages={hasMultipleLanguages} />
                    )}
                </div>
            }
            footerLinks={footerLinks}
            builtWithFern={<BuiltWithFern className="mx-auto mt-12 w-fit" lang={lang} />}
            lastUpdated={lastUpdated}
        />
    );
}
