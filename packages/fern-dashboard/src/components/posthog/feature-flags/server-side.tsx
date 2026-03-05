import { redirect } from "next/navigation";
import { cache } from "react";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { getServerSidePosthog } from "../getServerSidePosthog";
import type { PosthogFeatureFlag, PosthogFeatureFlags } from "./flags";

export declare namespace FeatureFlaggedServerSide {
    export interface Props {
        flag: PosthogFeatureFlag;
        redirectWhenDisabled?: boolean;
        redirectTo?: string;
        orgName: Auth0OrgName;
        children: React.JSX.Element;
    }
}

export async function FeatureFlaggedServerSide({
    flag,
    redirectWhenDisabled = false,
    redirectTo,
    orgName,
    children
}: FeatureFlaggedServerSide.Props) {
    const session = await getCurrentSessionOrThrow();
    const isEnabled = await isFeatureFlagEnabledForUser(flag, session.user.sub, orgName);

    if (isEnabled) {
        return children;
    }

    if (redirectWhenDisabled) {
        const redirectUrl = redirectTo || `/${orgName}/members`;
        redirect(redirectUrl);
    }

    return null;
}

export const isFeatureFlagEnabledForUser = async (
    featureFlag: PosthogFeatureFlag,
    userId: Auth0UserID,
    orgName: Auth0OrgName
) => {
    const posthog = getServerSidePosthog();
    return await posthog.isFeatureEnabled(featureFlag, userId, {
        personProperties: {
            orgName: orgName
        }
    });
};

export const getAllFeatureFlags = cache(async (userId: Auth0UserID, orgName?: Auth0OrgName) => {
    const posthog = getServerSidePosthog();
    const flags = await posthog.getAllFlags(userId, {
        personProperties: orgName != null ? { orgName } : {}
    });
    return flags as PosthogFeatureFlags;
});
