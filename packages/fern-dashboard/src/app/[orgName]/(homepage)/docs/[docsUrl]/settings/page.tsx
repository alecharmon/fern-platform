import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isAskAiEnabled } from "@/app/actions/toggleAskAi";
import { isFernEmployee } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { ArchiveSiteButton } from "@/components/settings/ArchiveSiteButton";
import { DeleteDocsSiteButton } from "@/components/settings/DeleteDocsSiteButton";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ToggleAskAiButton } from "@/components/settings/ToggleAskAiButton";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function Page({
    params
}: {
    params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}) {
    const { orgName, docsUrl: encodedDocsUrl } = await params;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    const session = await getAuthenticatedSessionOrRedirect(orgName);
    const isEmployee = await isFernEmployee(session.user.sub);
    if (!isEmployee) {
        redirect(`/${orgName}/docs/${docsUrl}`);
    }

    return (
        <div className="flex flex-1 flex-col items-center gap-4">
            <SettingsCard
                title="Archive site"
                description="This will hide the site from the dashboard, but any deployed domains will remain live."
                button={<ArchiveSiteButton docsUrl={docsUrl} orgName={orgName} />}
            />

            <SettingsCard
                title="Ask AI"
                description="This will turn on or turn off AI search for this documentation site."
                button={
                    <Suspense fallback={<Skeleton className="h-9 w-32" />}>
                        <ToggleAskAiButton
                            docsUrl={docsUrl}
                            initialAskAiStatus={await isAskAiEnabled({ domain: docsUrl })}
                        />
                    </Suspense>
                }
            />
            <SettingsCard
                title="Delete docs site"
                description="This is a destructive action and cannot be reversed."
                button={<DeleteDocsSiteButton docsUrl={docsUrl} orgName={orgName} />}
            />
        </div>
    );
}
