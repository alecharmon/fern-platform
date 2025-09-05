import { redirect } from "next/navigation";
import React from "react";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";

import Page404 from "../Page404";

export declare namespace ProtectedRoute {
  export interface Props {
    orgName: Auth0OrgName;
    children: React.JSX.Element;
  }
}

export const ProtectedRoute = async ({
  orgName,
  children,
}: ProtectedRoute.Props) => {
  const session = await getCurrentSession();

  if (session == null) {
    redirect("/");
  }

  const isUserInOrgFromUrl = await auth0Management.doesUserBelongToOrg(
    session.user.sub,
    orgName
  );

  if (!isUserInOrgFromUrl) {
    return <Page404 />;
  }

  return children;
};
