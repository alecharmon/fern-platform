import { cn } from "../cn";
import { EditThisPageButton } from "../EditThisPage";

export function AbstractFooterLayout({
    lang,
    feedback,
    hideNavLinks,
    editThisPageUrl,
    bottomNavigation,
    className,
    builtWithFern
}: {
    lang: string;
    feedback?: React.ReactNode;
    hideNavLinks?: boolean;
    editThisPageUrl?: string;
    bottomNavigation?: React.ReactNode;
    pathname?: string;
    className?: string;
    builtWithFern?: React.ReactNode;
}) {
    return (
        <footer className={cn("fern-layout-footer not-prose", className)}>
            <div className="fern-layout-footer-toolbar">
                {feedback}
                <EditThisPageButton editThisPageUrl={editThisPageUrl} lang={lang} />
            </div>

            {!hideNavLinks && bottomNavigation}
            {builtWithFern}
        </footer>
    );
}
