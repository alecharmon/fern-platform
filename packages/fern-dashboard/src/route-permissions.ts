import type { AuthZPermission, ResourceType, RoutePermissionConfig } from "@fern-api/user-permissions";
import { hasRoutePermission } from "@fern-api/user-permissions";
import jwt from "jsonwebtoken";
import { type NextRequest, NextResponse } from "next/server";
import { getAuth0Client } from "./app/services/auth0/auth0";

/**
 * Checks if the current route requires specific permissions and validates user access.
 * Returns a 403 response if the user lacks required permissions, or null if access is allowed.
 */
export async function checkRoutePermissions(req: NextRequest): Promise<NextResponse | null> {
    const { pathname } = req.nextUrl;

    // First check if any route config matches this pathname
    const matchingConfig = ROUTE_PERMISSION_CONFIGS.find((config) => config.pattern.test(pathname));

    // If no config matches, this route doesn't require permissions
    if (!matchingConfig) {
        return null;
    }

    // Route requires permission - get the session to check user permissions
    const auth0 = await getAuth0Client();
    const session = await auth0.getSession();

    // If no session, user is not authenticated - return 401
    if (!session) {
        return NextResponse.json({ error: "Unauthorized", message: "Authentication required" }, { status: 401 });
    }

    // Extract permissions, user ID, and org ID from the access token
    const accessToken = session.tokenSet.accessToken;
    const decodedToken = accessToken
        ? (jwt.decode(accessToken) as { permissions?: string[]; sub?: string; org_id?: string } | null)
        : null;
    const sessionPermissions = decodedToken?.permissions ?? [];
    const userId = decodedToken?.sub ?? session.user.sub;
    const orgId = decodedToken?.org_id ?? "";

    // Check if user has the required permission
    const { allowed } = await hasRoutePermission({
        pathname,
        sessionPermissions,
        userId,
        orgId,
        routeConfigs: ROUTE_PERMISSION_CONFIGS
    });

    if (!allowed) {
        return NextResponse.json(
            {
                error: "Forbidden",
                message: `Missing required permission`
            },
            { status: 403 }
        );
    }

    return null;
}

/**
 * Creates a route permission config from a path pattern.
 * Supports :param for path segments and * for optional suffixes.
 * Example: "/:org/docs/:docUrl/settings*" matches "/acme/docs/my-doc/settings/foo"
 */
export function route(path: string, permission: AuthZPermission): RoutePermissionConfig {
    const regexStr = path.replace(/:(\w+)/g, "[^/]+").replace(/\*/g, "(/.*)?");
    return { pattern: new RegExp(`^${regexStr}$`), requiredPermission: permission };
}

/**
 * Creates a route permission config with resource-scoped permissions.
 * The resourceParam specifies which :param in the path should be captured as the resource ID.
 */
export function routeWithResource(
    path: string,
    permission: AuthZPermission,
    resourceParam: string,
    resourceType: ResourceType = "docs"
): RoutePermissionConfig {
    let captureGroup = 0;
    let resourceCaptureGroup = 1;

    const regexStr = path
        .replace(/:(\w+)/g, (_, name) => {
            captureGroup++;
            if (name === resourceParam) {
                resourceCaptureGroup = captureGroup;
            }
            return "([^/]+)";
        })
        .replace(/\*/g, "(/.*)?");

    return {
        pattern: new RegExp(`^${regexStr}$`),
        requiredPermission: permission,
        resourceScope: { resourceType, captureGroup: resourceCaptureGroup }
    };
}

/**
 * Route permission configurations.
 * Each route pattern maps to a required permission.
 */
export const ROUTE_PERMISSION_CONFIGS: RoutePermissionConfig[] = [
    route("/api/users*", "manage-users"),
    route("/api/settings*", "manage-settings"),
    route("/api/update-user-permissions", "manage-users"),
    routeWithResource("/:org/docs/:docUrl/settings*", "manage-settings", "docUrl"),
    routeWithResource("/:org/docs/:docUrl/members*", "manage-users", "docUrl")
];
