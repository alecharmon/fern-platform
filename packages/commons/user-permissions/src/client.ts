import { ManagementClient } from "auth0";
import { err, ok, type Result } from "neverthrow";
import { auth0Error, type UserPermissionsError } from "./errors";

// Internal singleton for lazy loading
let MANAGEMENT_CLIENT: ManagementClient | undefined;

export function getManagementClient(): ManagementClient {
    if (MANAGEMENT_CLIENT) {
        return MANAGEMENT_CLIENT;
    }
    const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET } = process.env;
    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
        throw new Error(
            "Missing Auth0 configuration: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET must be defined."
        );
    }
    MANAGEMENT_CLIENT = new ManagementClient({
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        clientSecret: AUTH0_CLIENT_SECRET
    });
    return MANAGEMENT_CLIENT;
}

/**
 * Get the Auth0 Management Client, returning Result instead of throwing.
 */
export function getManagementClientResult(): Result<ManagementClient, UserPermissionsError> {
    if (MANAGEMENT_CLIENT) {
        return ok(MANAGEMENT_CLIENT);
    }
    const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET } = process.env;
    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
        return err(
            auth0Error(
                "NOT_CONFIGURED",
                "Missing Auth0 configuration: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET must be defined."
            )
        );
    }
    MANAGEMENT_CLIENT = new ManagementClient({
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        clientSecret: AUTH0_CLIENT_SECRET
    });
    return ok(MANAGEMENT_CLIENT);
}
