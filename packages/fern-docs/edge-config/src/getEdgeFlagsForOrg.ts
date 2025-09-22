import type { OrgEdgeFlags } from "@fern-api/docs-utils";
import { DEFAULT_ORG_EDGE_FLAGS } from "@fern-api/docs-utils";

import { getAllEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

const ORG_LEVEL_EDGE_FLAGS = ["bypass-extended-github-auth" as const];

type OrgEdgeFlag = (typeof ORG_LEVEL_EDGE_FLAGS)[number];

type EdgeConfigResponse = Record<
  OrgEdgeFlag,
  string[] | Record<string, unknown>
>;

export async function getEdgeFlagsForOrg(
  orgName: string
): Promise<OrgEdgeFlags> {
  if (isLocal()) {
    return DEFAULT_ORG_EDGE_FLAGS;
  } else if (isSelfHosted()) {
    return DEFAULT_ORG_EDGE_FLAGS;
  }

  try {
    const config = await getAllEdge<EdgeConfigResponse>(ORG_LEVEL_EDGE_FLAGS);
    if (config === undefined) {
      throw new Error("Failed to fetch edge config");
    }

    const bypassExtendedGithubAuth = checkOrgNameMatchesCustomers(
      orgName,
      config["bypass-extended-github-auth"]
    );

    return {
      bypassExtendedGithubAuth,
    };
  } catch (e) {
    console.error(`[get-edge-flags-for-org] ${JSON.stringify(e)}`);
    return {
      bypassExtendedGithubAuth: false,
    };
  }
}
function checkOrgNameMatchesCustomers(
  orgName: string,
  customers?: readonly string[] | Record<string, unknown>
): boolean {
  if (customers == null) {
    return false;
  }

  if (Array.isArray(customers)) {
    return (
      customers.some((customer) =>
        orgName.toLowerCase().includes(customer.toLowerCase())
      ) || customers.includes(orgName)
    );
  } else {
    return (
      Object.keys(customers).some((key) =>
        orgName.toLowerCase().includes(key.toLowerCase())
      ) || orgName in customers
    );
  }
}
