"use client";

import { useRouter } from "next/navigation";
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
    maxAttempts = 10,
    pollIntervalMs = 3000
}: SilentReauthLoaderProps) {
    const router = useRouter();
    const [attempt, setAttempt] = useState(0);
    const loginUrl = `/auth/login?organization=${encodeURIComponent(orgId)}&redirect_on_login=${encodeURIComponent(destination)}`;

    useEffect(() => {
        let mounted = true;
        let timeoutId: NodeJS.Timeout;

        function triggerSilentReauth() {
            // Use hidden iframe for silent re-auth
            const iframe = document.createElement("iframe");
            iframe.style.display = "none";
            iframe.src = `/auth/login?organization=${encodeURIComponent(orgId)}&prompt=none`;
            iframe.onload = () => {
                // Remove iframe after it loads (auth flow completed or failed)
                setTimeout(() => {
                    if (iframe.parentNode) {
                        iframe.parentNode.removeChild(iframe);
                    }
                }, 1000);
            };
            document.body.appendChild(iframe);
        }

        async function checkSessionAndRedirect() {
            if (!mounted) {
                return;
            }

            try {
                // Check if user has valid session with org access and permissions
                const response = await fetch(`/api/auth/check-org-access?org_id=${encodeURIComponent(orgId)}`);
                const data: AccessCheckResult = await response.json();

                if (!mounted) {
                    return;
                }

                if (data.hasAccess) {
                    // User has org access with permissions, hard redirect to destination
                    // Use window.location to force a full page load with updated session cookies
                    router.push(loginUrl);
                }

                // No access yet, try silent re-auth or retry
                if (attempt < maxAttempts) {
                    setAttempt((prev) => prev + 1);

                    if (attempt === 0) {
                        // First attempt: trigger silent re-auth via iframe
                        triggerSilentReauth();
                    }

                    // Poll again after interval
                    timeoutId = setTimeout(checkSessionAndRedirect, pollIntervalMs);
                } else {
                    // Max attempts reached, fall back to full login
                    router.push(loginUrl);
                }
            } catch (error) {
                console.error("Failed to check org access:", error);
                if (mounted && attempt < maxAttempts) {
                    setAttempt((prev) => prev + 1);
                    timeoutId = setTimeout(checkSessionAndRedirect, pollIntervalMs);
                } else if (mounted) {
                    // Fall back to full login on error
                    router.push(loginUrl);
                }
            }
        }

        checkSessionAndRedirect();

        return () => {
            mounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [orgId, attempt, maxAttempts, pollIntervalMs, router, loginUrl]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Setting up your workspace...</p>
        </div>
    );
}
