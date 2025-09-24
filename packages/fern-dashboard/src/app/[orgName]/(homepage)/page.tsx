import { redirect } from "next/navigation";

import { getCurrentSession } from "../../services/auth0/getCurrentSession";
import { Auth0OrgName } from "../../services/auth0/types";

export default async function Page({
  params,
}: {
  params: Promise<{ orgName: Auth0OrgName }>;
}) {
  const session = await getCurrentSession();
  if (session == null) {
    redirect("/");
  }

  const { orgName } = await params;

  redirect(`/${orgName}/docs`);
}
