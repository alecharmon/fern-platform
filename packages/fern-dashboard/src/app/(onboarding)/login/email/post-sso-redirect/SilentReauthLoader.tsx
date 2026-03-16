"use client";

import { FullScreenLoader } from "@/components/ui/full-screen-loader";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

interface SilentReauthLoaderProps {
    orgId: string;
    destination: string;
    maxAttempts?: number;
    pollIntervalMs?: number;
}

interface AccessCheckResult {
    hasAccess: boolean;
    isMember?: boolean;
    hasOrgScopedToken?: boolean;
    hasPermissions?: boolean;
    permissionCount?: number;
}

export default function SilentReauthLoader({
    orgId,
    destination,
    maxAttempts = 4,
    pollIntervalMs = 2000
}: SilentReauthLoaderProps) {
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let mounted = true;
        let timeoutId: NodeJS.Timeout;

        async function checkAndRedirect() {
            if (!mounted) {
                return;
            }

            try {
                const response = await fetch(`/api/auth/check-org-access?org_id=${encodeURIComponent(orgId)}`);
                const data: AccessCheckResult = await response.json();

                if (!mounted) {
                    return;
                }

                if (data.hasAccess) {
                    // Token already has org scope — go straight to the destination.
                    // destination is an orgRedirect URL (/auth/login?...) that will
                    // establish the org-scoped session and redirect to the dashboard.
                    window.location.href = destination;
                    return;
                }

                if (attempt < maxAttempts) {
                    // Permissions may still be propagating; wait and retry
                    setAttempt((prev) => prev + 1);
                    timeoutId = setTimeout(checkAndRedirect, pollIntervalMs);
                } else {
                    // Exhausted all polling attempts — token still not org-scoped.
                    Sentry.captureMessage("SilentReauthLoader: org access polling exhausted", {
                        level: "error",
                        extra: {
                            orgId,
                            maxAttempts,
                            pollIntervalMs,
                            lastResult: data
                        }
                    });
                    // Redirect through Auth0 to get an org-scoped token.
                    // destination is already an orgRedirect URL that handles this.
                    window.location.href = destination;
                }
            } catch (error) {
                console.error("Failed to check org access:", error);
                Sentry.captureException(error, {
                    extra: { orgId, attempt, maxAttempts }
                });
                if (mounted) {
                    // On error, redirect through Auth0 rather than showing an error
                    window.location.href = destination;
                }
            }
        }

        checkAndRedirect();

        return () => {
            mounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [orgId, attempt, maxAttempts, pollIntervalMs, destination]);

    return <FullScreenLoader message="Setting up your workspace..." />;
}
