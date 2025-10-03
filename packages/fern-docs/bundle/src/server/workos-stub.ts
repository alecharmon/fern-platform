export class WorkOS {
    sso = {
        getAuthorizationUrl: () => {
            throw new Error("WorkOS is not available in self-hosted mode");
        }
    };

    userManagement = {
        authenticateWithCode: () => {
            throw new Error("WorkOS is not available in self-hosted mode");
        },
        authenticateWithRefreshToken: () => {
            throw new Error("WorkOS is not available in self-hosted mode");
        },
        revokeSession: () => {
            throw new Error("WorkOS is not available in self-hosted mode");
        },
        getJwksUrl: () => {
            throw new Error("WorkOS is not available in self-hosted mode");
        }
    };
}
export const AuthorizationURLOptions = {};
export const User = {};
export const Impersonator = {};
