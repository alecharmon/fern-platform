"use server";

import { revalidateTag } from "next/cache";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import {
  addUserToOrg,
  doesUserBelongToOrg,
  ensureUserBelongsToOrgCacheTag,
  getInviteToken,
  invalidateInviteToken,
} from "../services/auth0/management";
import { Auth0OrgName, Auth0UserID } from "../services/auth0/types";
import { getAvailableOrgsForUserCacheTag } from "../services/dal/fdr/getAvailableOrgsForUser";

export type RedeemInviteTokenErrors =
  | { type: "NOT_LOGGED_IN" }
  | { type: "INVITE_TOKEN_NOT_FOUND" }
  | { type: "EXPIRED_INVITE_TOKEN" };

export async function redeemInviteToken({
  token,
}: {
  token: string;
}): Promise<
  | { success: true; orgName: Auth0OrgName }
  | { success: false; error: RedeemInviteTokenErrors }
> {
  let userId: Auth0UserID;
  try {
    const session = await getCurrentSessionOrThrow();
    userId = Auth0UserID(session.user.sub);
  } catch (_) {
    return { success: false, error: { type: "NOT_LOGGED_IN" } };
  }

  // Get the invite token from cache
  const inviteToken = await getInviteToken(token);

  if (!inviteToken) {
    return {
      success: false,
      error: { type: "INVITE_TOKEN_NOT_FOUND" },
    };
  }

  // Check if token has expired
  if (new Date() > new Date(inviteToken.expiresAt)) {
    // Clean up expired token
    await invalidateInviteToken(token);
    return {
      success: false,
      error: { type: "EXPIRED_INVITE_TOKEN" },
    };
  }

  // Check if user is already a member
  if (await doesUserBelongToOrg(userId, inviteToken.orgName)) {
    // Clean up the token since it's been used
    await invalidateInviteToken(token);
    return { success: true, orgName: inviteToken.orgName };
  }

  // Add user to organization
  await addUserToOrg(userId, inviteToken.orgName);

  // Clean up the token since it's been used (one-time use)
  await invalidateInviteToken(token);

  // Invalidate the cache for the user's available organizations and org access
  revalidateTag(getAvailableOrgsForUserCacheTag(userId));
  revalidateTag(ensureUserBelongsToOrgCacheTag(userId, inviteToken.orgName));

  // Redirect to organization
  return { success: true, orgName: inviteToken.orgName };
}
