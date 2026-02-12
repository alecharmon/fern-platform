import { Suspense } from "react";
import { isAskAiEnabled } from "@/app/actions/toggleAskAi";
import { isFernEmployee } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { ArchiveSiteButton } from "@/components/settings/ArchiveSiteButton";
import { PdfExporterSettingsCard } from "@/components/settings/PdfExporterSettingsCard";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ToggleAskAiButton } from "@/components/settings/ToggleAskAiButton";
import { Skeleton } from "@/components/ui/skeleton";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
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
    const isEmployee = isFernEmployee(session.permissions ?? []);

    const host = await getHostFromHeaders();
    const loader = await getCachedEditableDocsLoader(host, encodedDocsUrl, session.accessToken);
    const config = await loader.getConfig();

    const defaultCoverTitle = config.title || "Documentation";

    return (
        <div className="flex flex-1 flex-col items-center gap-4">
            <PdfExporterSettingsCard docsUrl={docsUrl} orgName={orgName} defaultCoverTitle={defaultCoverTitle} />
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
            {isEmployee && (
                <SettingsCard
                    title="Archive site"
                    description="This will hide the site from the dashboard, but any deployed domains will remain live."
                    button={<ArchiveSiteButton docsUrl={docsUrl} orgName={orgName} />}
                />
            )}
        </div>
    );
}
