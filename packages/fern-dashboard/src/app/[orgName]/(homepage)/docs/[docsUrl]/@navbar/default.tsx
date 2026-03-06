import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getCachedDocsGitUrl } from "@/app/services/dal/github/cachedGetDocsGitUrl";
import { getCachedAskAiStatus } from "@/app/services/fai/cachedAskAiStatus";
import { DocsSiteNavBarWithOverflow, type NavItem } from "@/components/docs-page/DocsSiteNavBarWithOverflow";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

export default async function DocsSiteNavbar({ params }: Readonly<{ params: Promise<{ docsUrl: string }> }>) {
    const { docsUrl } = await params;

    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    const parsedDocsUrl = parseDocsUrlParam({ docsUrl });

    // Fetch Ask AI status and git URL in parallel (both are cached)
    const [askAiStatus, gitUrlResult] = await Promise.all([
        getCachedAskAiStatus(parsedDocsUrl).catch((error) => {
            console.error("Failed to fetch Ask AI status:", error);
            return null;
        }),
        getCachedDocsGitUrl(parsedDocsUrl).catch((error) => {
            console.error("Failed to fetch git URL:", error);
            return null;
        })
    ]);

    const siteHasConnectedRepo = gitUrlResult?.success ?? false;

    const navItems: NavItem[] = [
        { title: "Overview", href: "" },
        { title: "Web Analytics", href: "web-analytics" },
        { title: "Search", href: "search" },
        { title: "Link Checker", href: "link-checker" },
        { title: "Feedback", href: "feedback" },
        { title: "Settings", href: "settings", permission: "manage-settings" }
    ];

    if (askAiStatus?.ask_ai_enabled || askAiStatus?.job_id) {
        navItems.splice(5, 0, { title: "Ask Fern", href: "ask-fern" });
    }

    return <DocsSiteNavBarWithOverflow items={navItems} siteHasConnectedRepo={siteHasConnectedRepo} />;
}
