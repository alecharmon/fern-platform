import type { Auth0Organization } from "@/app/services/auth0/types";

import { OrgPlaceholderLogo } from "./OrgPlaceholderLogo";
import { SvgOrgLogo } from "./SvgOrgLogo";

export declare namespace OrgLogoContent {
    export interface Props {
        organization: Auth0Organization;
    }
}

export function OrgLogoContent({ organization }: OrgLogoContent.Props) {
    if (organization.branding?.logo_url == null) {
        return <OrgPlaceholderLogo org={organization} />;
    }

    if (organization.branding.logo_url.endsWith(".svg")) {
        return (
            <SvgOrgLogo svgUrl={organization.branding.logo_url} fallback={<OrgPlaceholderLogo org={organization} />} />
        );
    }

    return (
        // biome-ignore lint/performance/noImgElement: false positive
        <img
            src={organization.branding.logo_url}
            alt={`${organization.display_name} logo`}
            className="size-full rounded object-contain object-left"
        />
    );
}
