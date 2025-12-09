import { t } from "@fern-docs/i18n";
import { cn } from "../cn";
import { EditThisPageButton } from "../EditThisPage";

export function AbstractFooterLayout({
    lang,
    feedback,
    hideNavLinks,
    editThisPageUrl,
    bottomNavigation,
    className,
    builtWithFern,
    lastUpdated
}: {
    lang: string;
    feedback?: React.ReactNode;
    hideNavLinks?: boolean;
    editThisPageUrl?: string;
    bottomNavigation?: React.ReactNode;
    pathname?: string;
    className?: string;
    builtWithFern?: React.ReactNode;
    lastUpdated?: string;
}) {
    const lastUpdatedElement = lastUpdated && (
        <p className="text-sm text-(color:--grayscale-a11)">
            {t(lang).navigation.lastUpdated} {lastUpdated}
        </p>
    );

    return (
        <footer className={cn("fern-layout-footer not-prose", className)}>
            <div className="fern-layout-footer-toolbar">
                {feedback}
                {editThisPageUrl ? (
                    <EditThisPageButton editThisPageUrl={editThisPageUrl} lang={lang} />
                ) : (
                    lastUpdatedElement
                )}
            </div>

            {editThisPageUrl && lastUpdatedElement}

            {!hideNavLinks && bottomNavigation}
            {builtWithFern}
        </footer>
    );
}
