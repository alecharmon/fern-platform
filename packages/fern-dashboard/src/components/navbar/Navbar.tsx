import { Auth0OrgName } from "@/app/services/auth0/types";

import { PosthogFeatureFlag } from "../posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "../posthog/feature-flags/server-side";
import { DocsNavbarItems } from "./DocsNavbarItems";
import { NavbarItem } from "./NavbarItem";
import { NavbarSectionTitle } from "./NavbarSectionTitle";

export declare namespace Navbar {
  export interface Props {
    orgName: Auth0OrgName;
  }
}

export function Navbar({ orgName }: Navbar.Props) {
  return (
    <div className="flex h-full w-fit max-w-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] md:w-[var(--sidebar-width)] md:border-0 md:py-6 md:pl-4 md:transition-[width]">
      <div className="flex gap-8 overflow-y-auto px-8 md:flex-col md:gap-0 md:px-0 md:pb-4">
        <DocsNavbarItems />
        <FeatureFlaggedServerSide
          flag={PosthogFeatureFlag.ENABLE_SDKS_PAGE}
          orgName={orgName}
        >
          <NavbarItem title="SDKs" iconType="sdks" href="/sdks" />
        </FeatureFlaggedServerSide>
        <NavbarSectionTitle title="Settings" />
        <NavbarItem title="Members" iconType="members" href="/members" />
        <FeatureFlaggedServerSide
          flag={PosthogFeatureFlag.ENABLE_API_KEYS_PAGE}
          orgName={orgName}
        >
          <NavbarItem title="API Keys" iconType="api-keys" href="/api-keys" />
        </FeatureFlaggedServerSide>
        <FeatureFlaggedServerSide
          flag={PosthogFeatureFlag.ENABLE_BILLING_PAGE}
          orgName={orgName}
        >
          <NavbarItem title="Billing" iconType="billing" href="/billing" />
        </FeatureFlaggedServerSide>
      </div>
    </div>
  );
}
