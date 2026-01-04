import { Suspense } from "react";

import { getCustomDomainStatus } from "@/app/actions/customDomain";
import { getDocsSiteDomains } from "@/app/actions/getDocsSiteDomains";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { Skeleton } from "../ui/skeleton";
import { CustomDomainCard } from "./CustomDomainCard";
import { SettingsCard } from "./SettingsCard";

interface CustomDomainSectionProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

async function CustomDomainContent({ docsUrl, orgName }: CustomDomainSectionProps) {
    const [result, allUrls] = await Promise.all([
        getCustomDomainStatus({ docsUrl, orgName }),
        getDocsSiteDomains(docsUrl, orgName).catch(() => [])
    ]);

    // Extract all domains from the URLs
    const allDomains = allUrls.map((url) => url.domain);

    return (
        <CustomDomainCard
            docsUrl={docsUrl}
            orgName={orgName}
            domainInfo={result.hasCustomDomain ? result.domainInfo : undefined}
            allDomains={allDomains}
        />
    );
}

export function CustomDomainSection({ docsUrl, orgName }: CustomDomainSectionProps) {
    return (
        <SettingsCard
            title="Custom Domain"
            description="Connect your own domain to this documentation site. Each docs site can have one custom domain."
            button={
                <Suspense fallback={<Skeleton className="h-9 w-32" />}>
                    <CustomDomainContent docsUrl={docsUrl} orgName={orgName} />
                </Suspense>
            }
        />
    );
}
