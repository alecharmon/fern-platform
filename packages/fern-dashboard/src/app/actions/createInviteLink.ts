"use server";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import {
  createInviteToken,
  ensureUserBelongsToOrg,
} from "../services/auth0/management";
import { Auth0OrgName } from "../services/auth0/types";

export async function createInviteLink({ orgName }: { orgName: Auth0OrgName }) {
  const session = await getCurrentSessionOrThrow();
  await ensureUserBelongsToOrg(session.user.sub, orgName);

  const { token, expiresAt } = await createInviteToken(
    orgName,
    session.user.sub
  );

  // Generate the invite URL
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.buildwithfern.com";
  const inviteUrl = `${baseUrl}/accept-invite/${token}`;

  return {
    token,
    inviteUrl,
    expiresAt,
  };
}
