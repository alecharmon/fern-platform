import "server-only";

import { getCustomDomainStatus } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { CustomDomainButton } from "./CustomDomainButton";

interface CustomDomainSectionProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    allDomains: string[];
}

export async function CustomDomainSection({ docsUrl, orgName, allDomains }: CustomDomainSectionProps) {
    const result = await getCustomDomainStatus({ docsUrl, orgName, detectedDomains: allDomains });

    return (
        <CustomDomainButton
            docsUrl={docsUrl}
            orgName={orgName}
            domainInfo={result.hasCustomDomain ? result.domainInfo : undefined}
            allDomains={allDomains}
        />
    );
}
