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

export default (organization: { id: Auth0OrgID; name: Auth0OrgName }, pathname: string = "") => {
    const searchParams = new URLSearchParams({
        redirect_on_login: getRedirectPathForOrg(organization.name, pathname),
        organization: organization.id,
        scope: "openid profile email"
    });

    if (process.env.NEXT_PUBLIC_VENUS_AUDIENCE) {
        searchParams.set("audience", process.env.NEXT_PUBLIC_VENUS_AUDIENCE);
    }

    return `/auth/login?${searchParams.toString()}`;
};
