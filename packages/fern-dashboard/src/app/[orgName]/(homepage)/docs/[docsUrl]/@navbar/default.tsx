import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { isFernEmployee } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { AskAiEnabledServerSide } from "@/components/ask-ai/AskAiEnabledServerSide";
import { DocsSiteNavBarItem } from "@/components/docs-page/DocsSiteNavBarItem";

export default async function DocsSiteNavbar({
    params
}: Readonly<{ params: Promise<{ orgName: Auth0OrgName; docsUrl: string }> }>) {
    const { docsUrl } = await params;

    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    const isEmployee = await isFernEmployee(session.user.sub);

    return (
        <div className="flex">
            <DocsSiteNavBarItem title="Overview" href="" />
            <DocsSiteNavBarItem title="Web Analytics" href="web-analytics" />
            <DocsSiteNavBarItem title="Search" href="search" />
            <AskAiEnabledServerSide docsUrl={docsUrl}>
                <DocsSiteNavBarItem title="Ask Fern" href="ask-fern" />
            </AskAiEnabledServerSide>
            <DocsSiteNavBarItem title="Feedback" href="feedback" />
            {isEmployee && <DocsSiteNavBarItem title="Settings" href="settings" />}
        </div>
    );
}
