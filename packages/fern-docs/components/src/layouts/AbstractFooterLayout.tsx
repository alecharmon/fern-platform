import { t } from "@fern-docs/i18n";
import { cn } from "../cn";
import { EditInDashboardButton, EditThisPageButton } from "../EditThisPage";

export function AbstractFooterLayout({
    lang,
    feedback,
    hideNavLinks,
    editThisPageUrl,
    editThisPageLaunch,
    docsUrl,
    slug,
    orgName,
    bottomNavigation,
    className,
    footerLinks,
    builtWithFern,
    lastUpdated
}: {
    lang: string;
    feedback?: React.ReactNode;
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
    builtWithFern?: React.ReactNode;
    lastUpdated?: string;
}) {
    const lastUpdatedElement = lastUpdated && (
        <div className="flex items-center">
            <p className="text-sm text-(color:--grayscale-a11)">
                {t(lang).navigation.lastUpdated} {lastUpdated}
            </p>
        </div>
    );

    const renderEditButton = () => {
        // Show dashboard button if we have all required data, otherwise fall back to GitHub
        if (editThisPageLaunch === "dashboard" && docsUrl && slug != null && orgName) {
            return (
                <EditInDashboardButton
                    docsUrl={docsUrl}
                    slug={slug}
                    lang={lang}
                    orgName={orgName}
                    fallbackUrl={editThisPageUrl}
                />
            );
        }
        // Fallback to GitHub edit URL if dashboard isn't configured or missing orgName
        if (editThisPageUrl) {
            return <EditThisPageButton editThisPageUrl={editThisPageUrl} lang={lang} />;
        }
        return null;
    };

    const editButton = renderEditButton();

    return (
        <footer className={cn("fern-layout-footer not-prose", className)}>
            <div className="fern-layout-footer-toolbar">
                {feedback}
                {editButton ?? lastUpdatedElement}
            </div>

            {editButton && lastUpdatedElement}

            {!hideNavLinks && bottomNavigation}
            {builtWithFern}
            {footerLinks}
        </footer>
    );
}
