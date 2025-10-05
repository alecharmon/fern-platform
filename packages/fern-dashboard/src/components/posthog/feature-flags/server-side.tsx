import { redirect } from "next/navigation";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

import { getServerSidePosthog } from "../getServerSidePosthog";
import type { PosthogFeatureFlag, PosthogFeatureFlags } from "./flags";

export declare namespace FeatureFlaggedServerSide {
    export interface Props {
        flag: PosthogFeatureFlag;
        redirectWhenDisabled?: boolean;
        orgName: Auth0OrgName;
        children: React.JSX.Element;
    }
}

export async function FeatureFlaggedServerSide({
    flag,
    redirectWhenDisabled = false,
    orgName,
    children
}: FeatureFlaggedServerSide.Props) {
    const session = await getCurrentSessionOrThrow();
    const isEnabled = await isFeatureFlagEnabledForUser(flag, session.user.sub, orgName);

    if (isEnabled) {
        return children;
    }

    if (redirectWhenDisabled) {
        redirect(`/${orgName}/members`);
    }

    return null;
}

export async function isFeatureFlagEnabledForUser(
    featureFlag: PosthogFeatureFlag,
    userId: Auth0UserID,
    orgName: Auth0OrgName
) {
    const posthog = getServerSidePosthog();
    return await posthog.isFeatureEnabled(featureFlag, userId, {
        personProperties: {
            orgName: orgName
        }
    });
}

export async function getAllFeatureFlags(userId: Auth0UserID) {
    const posthog = getServerSidePosthog();
    const flags = await posthog.getAllFlags(userId);
    return flags as PosthogFeatureFlags;
}
