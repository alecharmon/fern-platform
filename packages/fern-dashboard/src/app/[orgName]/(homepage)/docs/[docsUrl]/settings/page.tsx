import { Suspense } from "react";
import { getBasepathRoutes } from "@/app/actions/domainSettings";
import { getLastReindexTime, isAskAiEnabled } from "@/app/actions/toggleAskAi";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { isFernEmployee } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { docsPermissionScope } from "@/components/auth/authz";
import { AuthZWrapperServer } from "@/components/auth/authz/AuthZWrapperServer";
import { ArchiveSiteButton } from "@/components/settings/ArchiveSiteButton";
import { DefaultPathSettingsContent } from "@/components/settings/DefaultPathSettingsCard";
import { DeleteDocsSiteCard } from "@/components/settings/DeleteDocsSiteCard";
import { ExpandableSetting, MultiRepoSettingsSection } from "@/components/settings/MultiRepoSettingsSection";
import { PasswordProtectionSettingsCard } from "@/components/settings/PasswordProtectionSettingsCard";
import { SearchBehaviorSettingsCard } from "@/components/settings/SearchBehaviorSettingsCard";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ToggleAskAiButton } from "@/components/settings/ToggleAskAiButton";
import { UnpublishSiteSettingsCard } from "@/components/settings/UnpublishSiteSettingsCard";
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

    // Auth is validated by the parent [docsUrl]/layout.tsx (session + org access + permissions).
    const session = (await getCurrentSession())!;
    const isEmployee = isFernEmployee(session.permissions ?? []);

    // Determine if this domain has multiple basepath sources by reading from Upstash
    const domain = docsUrl.includes("/") ? docsUrl.split("/")[0]! : docsUrl;
    const domainBasepaths = (await getBasepathRoutes({ domain, orgName })) ?? [];
    const hasBasepaths = domainBasepaths.length > 1;

    return (
        <div className="flex flex-1 flex-col items-center gap-4">
            {hasBasepaths && (
                <MultiRepoSettingsSection>
                    <ExpandableSetting title="Default path">
                        <DefaultPathSettingsContent domain={domain} orgName={orgName} basepaths={domainBasepaths} />
                    </ExpandableSetting>
                    <ExpandableSetting title="Search / Ask AI behavior">
                        <SearchBehaviorSettingsCard domain={domain} orgName={orgName} />
                    </ExpandableSetting>
                </MultiRepoSettingsSection>
            )}
            <PasswordProtectionSettingsCard docsUrl={docsUrl} orgName={orgName} />
            <SettingsCard
                title="Ask AI"
                description="This will turn on or turn off AI search for this documentation site."
                button={
                    <Suspense fallback={<Skeleton className="h-9 w-32" />}>
                        <ToggleAskAiButton
                            docsUrl={docsUrl}
                            initialAskAiStatus={await isAskAiEnabled({ domain: docsUrl })}
                            initialLastReindexTime={await getLastReindexTime({ domain: docsUrl })}
                        />
                    </Suspense>
                }
            />
            <UnpublishSiteSettingsCard docsUrl={docsUrl} orgName={orgName} />
            {isEmployee && (
                <SettingsCard
                    title="Archive site"
                    description="This will hide the site from the dashboard, but any deployed domains will remain live."
                    button={<ArchiveSiteButton docsUrl={docsUrl} orgName={orgName} />}
                />
            )}
            <AuthZWrapperServer
                permission="manage-settings"
                permissionScope={docsPermissionScope(docsUrl)}
                orgName={orgName}
            >
                <DeleteDocsSiteCard docsUrl={docsUrl} orgName={orgName} />
            </AuthZWrapperServer>
        </div>
    );
}
