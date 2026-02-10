import { ManagementClient } from "auth0";

let managementClient: ManagementClient | undefined;

/**
 * Returns a singleton Auth0 ManagementClient configured from environment variables.
 * Throws if AUTH0_DOMAIN, AUTH0_CLIENT_ID, or AUTH0_CLIENT_SECRET are missing.
 */
export function getAuth0ManagementClient(): ManagementClient {
    if (managementClient == null) {
        const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET } = process.env;

        if (AUTH0_DOMAIN == null) {
            throw new Error("AUTH0_DOMAIN is not defined");
        }
        if (AUTH0_CLIENT_ID == null) {
            throw new Error("AUTH0_CLIENT_ID is not defined");
        }
        if (AUTH0_CLIENT_SECRET == null) {
            throw new Error("AUTH0_CLIENT_SECRET is not defined");
        }

        managementClient = new ManagementClient({
            domain: AUTH0_DOMAIN,
            clientId: AUTH0_CLIENT_ID,
            clientSecret: AUTH0_CLIENT_SECRET,
            timeoutDuration: 60_000
        });
    }

    return managementClient;
}
