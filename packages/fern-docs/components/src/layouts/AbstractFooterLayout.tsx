import { EditThisPageButton } from "../EditThisPage";
import { cn } from "../cn";

export function AbstractFooterLayout({
    feedback,
    hideNavLinks,
    editThisPageUrl,
    bottomNavigation,
    className,
    builtWithFern
}: {
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
                <EditThisPageButton editThisPageUrl={editThisPageUrl} />
            </div>

            {!hideNavLinks && bottomNavigation}
            {builtWithFern}
        </footer>
    );
}
