"use client";

import type { User } from "@auth0/nextjs-auth0/types";
import CheckCircleIcon from "@heroicons/react/24/solid/CheckCircleIcon";
import { motion } from "motion/react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export declare namespace DocsZeroStateRequestOrgAccess {
    export interface Props {
        user: User;
    }
}

// Simple URL validation - allows URLs with or without protocol
function isValidUrl(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) {
        return false;
    }
    // Check for basic URL pattern: should have at least one dot and valid characters
    // Allows with or without protocol
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
    return urlPattern.test(trimmed);
}

export function DocsZeroStateRequestOrgAccess({ user }: DocsZeroStateRequestOrgAccess.Props) {
    const posthog = usePostHog();
    const [docsUrl, setDocsUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    // Poll for org access after successful request with backoff strategy
    // Most access grants happen within 30 minutes, so we poll more aggressively at first
    useEffect(() => {
        if (!isSuccess || !isPolling) {
            return;
        }

        const startTime = Date.now();
        let timeoutId: NodeJS.Timeout;

        const getNextInterval = (elapsedMinutes: number): number => {
            if (elapsedMinutes < 5) {
                return 20 * 1000; // First 5 min: every 20 seconds
            } else if (elapsedMinutes < 15) {
                return 60 * 1000; // 5-15 min: every 60 seconds
            } else if (elapsedMinutes < 30) {
                return 3 * 60 * 1000; // 15-30 min: every 3 minutes
            } else {
                return 9 * 60 * 1000; // After 30 min: every 9 minutes
            }
        };

        const poll = async () => {
            try {
                const response = await fetch("/api/get-my-organizations");
                if (response.ok) {
                    const orgs = await response.json();
                    // If user now has access to at least one org, navigate to root so redirects can happen
                    if (orgs && orgs.length > 0) {
                        window.location.href = "/";
                        return; // Stop polling
                    }
                }
            } catch (err) {
                console.error("Error polling for org access:", err);
            }

            // Schedule next poll with updated interval
            const elapsedMinutes = (Date.now() - startTime) / (60 * 1000);
            const nextInterval = getNextInterval(elapsedMinutes);
            timeoutId = setTimeout(() => void poll(), nextInterval);
        };

        // Start polling
        void poll();

        return () => clearTimeout(timeoutId);
    }, [isSuccess, isPolling]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValidUrl(docsUrl)) {
            toast.error("Please enter a valid URL");
            return;
        }

        // Track button click
        captureEvent(posthog, PosthogEventName.DOCS_REQUEST_ACCESS_CLICKED, {
            userEmail: user.email ?? "",
            docsUrl
        });

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/request-org-access", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ docsUrl })
            });

            if (!response.ok) {
                throw new Error("Failed to request access");
            }

            setIsSuccess(true);
            setIsPolling(true);

            // Track success
            captureEvent(posthog, PosthogEventName.DOCS_REQUEST_ACCESS_SUCCESS, {
                userEmail: user.email ?? "",
                docsUrl
            });
        } catch (err) {
            setError("Failed to request access. Please try again.");
            console.error("Error requesting org access:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center space-y-4 py-8"
            >
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <CheckCircleIcon className="size-6 text-green-800" />
                    Site access requested
                </h2>
                <p className="text-gray-1200 text-center text-sm">
                    If this site is associated with a Fern organization, this page will{" "}
                    <strong>automatically refresh</strong> once admin has approved your request.
                </p>
            </motion.div>
        );
    }

    if (!user.email) {
        return null;
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <Label>Enter your Fern docs site URL</Label>
            <Input
                autoFocus={true}
                type="text"
                value={docsUrl}
                onChange={(e) => setDocsUrl(e.target.value)}
                placeholder="e.g. https://docs.your-company.com"
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" disabled={isSubmitting} variant="default">
                {isSubmitting ? "Requesting..." : "Request access to Dashboard"}
            </Button>
        </form>
    );
}
