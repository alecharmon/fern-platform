import { FernThemedPage } from "./FernThemedPage";
import { UnpublishedPageContent } from "./UnpublishedPageContent";

interface UnpublishedPageProps {
    domain: string;
    basePath: string | undefined;
    lang: string;
}

export async function UnpublishedPage({ domain, basePath, lang }: UnpublishedPageProps) {
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://dashboard.buildwithfern.com";
    const docsUrl = basePath ? `${domain}${basePath}` : domain;
    const dashboardHref = `${dashboardUrl}/view/${encodeURIComponent(docsUrl)}`;

    return (
        <FernThemedPage lang={lang}>
            <UnpublishedPageContent dashboardHref={dashboardHref} />
        </FernThemedPage>
    );
}
