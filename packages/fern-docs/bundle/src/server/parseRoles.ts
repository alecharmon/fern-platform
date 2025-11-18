/**
 * Parse user roles from the authed query parameter.
 * Format: "authed:role1,role2,role3" or "unauthed:everyone"
 *
 * @param authedParam - The authed query parameter from the request
 * @returns An array of role strings (empty array if unauthenticated or no valid roles)
 *
 * @example
 * parseRolesFromAuthedParam("authed:admin,editor") // ["admin", "editor"]
 * parseRolesFromAuthedParam("unauthed:everyone") // []
 * parseRolesFromAuthedParam(null) // []
 */
export function parseRolesFromAuthedParam(authedParam: string | null): string[] {
    if (!authedParam) {
        return [];
    }

    const [authStatus, rolesStr] = authedParam.split(":");
    if (authStatus === "unauthed") {
        return []; // unauthenticated users have no roles
    }

    if (authStatus === "authed" && rolesStr) {
        return rolesStr.split(",").filter((role) => role && role !== "everyone");
    }

    return [];
}
