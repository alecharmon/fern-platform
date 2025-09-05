import { Auth0OrgName } from "@/app/services/auth0/types";

import { PosthogFeatureFlag } from "../posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "../posthog/feature-flags/server-side";
import { DocsSiteNavBarItem } from "./DocsSiteNavBarItem";

export declare namespace DocsSiteNavBar {
  export interface Props {
    orgName: Auth0OrgName;
  }
}

export async function DocsSiteNavBar({ orgName }: DocsSiteNavBar.Props) {
  return (
    <div className="flex">
      <DocsSiteNavBarItem title="Overview" href="" />
      <FeatureFlaggedServerSide
        flag={PosthogFeatureFlag.ENABLE_DOCS_ASK_FERN_TAB}
        orgName={orgName}
      >
        <DocsSiteNavBarItem title="Ask Fern" href="ask-fern" />
      </FeatureFlaggedServerSide>
      <DocsSiteNavBarItem title="Settings" href="settings" />
    </div>
  );
}
