import { getGitHubAuthState } from "@/app/actions/getGithubMetadata";
import { isAskAiEnabled } from "@/app/actions/toggleAskAi";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { isFernEmployee } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getDocsGitUrl } from "@/app/services/dal/github/getDocsGitUrl";
import { DocsSiteNavBarWithOverflow, type NavItem } from "@/components/docs-page/DocsSiteNavBarWithOverflow";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

export default async function DocsSiteNavbar({
    params
}: Readonly<{ params: Promise<{ orgName: Auth0OrgName; docsUrl: string }> }>) {
    const { orgName, docsUrl } = await params;

    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    const isEmployee = await isFernEmployee(session.user.sub);

    const parsedDocsUrl = parseDocsUrlParam({ docsUrl });
    let askAiStatus = null;
    try {
        askAiStatus = await isAskAiEnabled({ domain: parsedDocsUrl });
    } catch (error) {
        console.error("Failed to fetch Ask AI status:", error);
    }

    let siteHasGitHubAppInstalled = false;
    let siteHasConnectedRepo = false;
    try {
        const githubAuthState = await getGitHubAuthState(parsedDocsUrl, session.accessToken, orgName, session);
        siteHasGitHubAppInstalled = githubAuthState.success !== false && githubAuthState.validationResult.ok;
    } catch (error) {
        console.error("Failed to check GitHub App installation status:", error);
    }

    try {
        const githubUrlResult = await getDocsGitUrl(parsedDocsUrl, session.accessToken);
        siteHasConnectedRepo = githubUrlResult.success;
    } catch (error) {
        console.error("Failed to check if repo is connected:", error);
    }

    const navItems: NavItem[] = [
        { title: "Overview", href: "" },
        { title: "Web Analytics", href: "web-analytics" },
        { title: "Search", href: "search" },
        { title: "Link Checker", href: "link-checker" },
        { title: "Feedback", href: "feedback" }
    ];

    if (askAiStatus?.ask_ai_enabled || askAiStatus?.job_id) {
        navItems.splice(4, 0, { title: "Ask Fern", href: "ask-fern" });
    }

    if (isEmployee) {
        navItems.push({ title: "Settings", href: "settings" });
    }

    return (
        <DocsSiteNavBarWithOverflow
            items={navItems}
            siteHasGitHubAppInstalled={siteHasGitHubAppInstalled}
            siteHasConnectedRepo={siteHasConnectedRepo}
        />
    );
}
