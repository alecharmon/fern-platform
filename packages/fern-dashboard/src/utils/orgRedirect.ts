import type { Auth0OrgID, Auth0OrgName } from "@/app/services/auth0/types";

function getRedirectPathname(pathname: string) {
    if (!pathname || pathname === "/" || pathname.includes("get-started") || pathname.includes("/docs")) {
        return "/docs";
    }
    return pathname;
}

const getRedirectPathForOrg = (newOrgName: Auth0OrgName, pathname: string) => {
    return `/${newOrgName}${getRedirectPathname(pathname)}`;
};

interface OrgRedirectOptions {
    /** Use silent auth (prompt=none) to avoid full login redirect when possible */
    silent?: boolean;
}

export default (
    organization: { id: Auth0OrgID; name: Auth0OrgName },
    pathname: string = "",
    options: OrgRedirectOptions = { silent: true }
) => {
    const searchParams = new URLSearchParams({
        redirect_on_login: getRedirectPathForOrg(organization.name, pathname),
        organization: organization.id,
        scope: "openid profile email offline_access"
    });

    if (process.env.NEXT_PUBLIC_VENUS_AUDIENCE) {
        searchParams.set("audience", process.env.NEXT_PUBLIC_VENUS_AUDIENCE);
    }

    // Use silent auth by default to avoid full login redirect
    // If silent auth fails, middleware will retry with regular login
    if (options.silent) {
        searchParams.set("prompt", "none");
    }

    return `/auth/login?${searchParams.toString()}`;
};
