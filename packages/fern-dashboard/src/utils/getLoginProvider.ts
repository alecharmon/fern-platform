import type { AuthConnection } from "@/components/auth/LoginButton";

/**
 * Maps an AuthConnection value (stored in localStorage as `fern-last-used-login`)
 * to a human-readable provider label.
 *
 * Returns undefined if the connection is not recognized.
 */
export function getLoginProviderLabel(connection: string): string | undefined {
    const labels: Record<AuthConnection, string> = {
        "google-oauth2": "Google",
        github: "GitHub",
        postman: "Postman",
        "enterprise-sso": "SSO"
    };
    return labels[connection as AuthConnection];
}
