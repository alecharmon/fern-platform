"use client";

import { useRouter } from "@bprogress/next/app";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import { CreateOrganizationForm } from "@/components/auth/CreateOrganizationForm";
import { PostmanTeamSelector } from "@/components/auth/PostmanTeamSelector";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

interface PostmanOrgSelectionClientProps {
    accessToken: string;
    nextHref: string;
    initialOrgName?: string;
    postmanTeamId?: string;
    postmanCollectionId?: string;
}

type SelectionMode = "select" | "create-new";

export function PostmanOrgSelectionClient({
    accessToken,
    nextHref,
    initialOrgName,
    postmanTeamId,
    postmanCollectionId
}: PostmanOrgSelectionClientProps) {
    const [mode, setMode] = useState<SelectionMode>("select");
    const [isOverflowing, setIsOverflowing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const posthog = usePostHog();
    const hasTrackedView = useRef(false);

    useEffect(() => {
        if (!hasTrackedView.current) {
            captureEvent(posthog, PosthogEventName.CREATE_ORGANIZATION_STEP_VIEWED, {
                prepopulatedOrgName: initialOrgName,
                postmanTeamId
            });
            hasTrackedView.current = true;
        }
    }, [posthog, initialOrgName, postmanTeamId]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) {
            return;
        }
        const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight);
        check();
        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleCreateSuccess = (organizationId: string) => {
        const destination = nextHref.includes(":orgId") ? nextHref.replace(/:orgId/g, organizationId) : nextHref;
        const params = new URLSearchParams();
        if (postmanCollectionId) {
            params.set("collection-id", postmanCollectionId);
        }
        if (postmanTeamId) {
            params.set("postman-team-id", postmanTeamId);
        }
        const queryString = params.toString();
        router.push(queryString ? `${destination}?${queryString}` : destination);
    };

    if (mode === "create-new") {
        return (
            <>
                <div className="flex items-center gap-2 mb-2">
                    <button
                        type="button"
                        className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => setMode("select")}
                    >
                        &larr; Back
                    </button>
                </div>
                <h1 className="text-2xl font-semibold">Create a new organization</h1>
                <p className="text-sm text-muted-foreground">Create a new Fern organization for your Postman team.</p>
                <div className="mt-4">
                    <CreateOrganizationForm
                        accessToken={accessToken}
                        onSuccess={handleCreateSuccess}
                        hideLabel
                        submitButtonText="Continue"
                        initialOrganizationName={initialOrgName}
                        postmanTeamId={postmanTeamId}
                    />
                </div>
            </>
        );
    }

    return (
        <div className="flex max-h-full flex-col">
            <h1 className="text-2xl font-semibold">Select a Fern org to associate with your Postman team</h1>
            <div ref={scrollRef} className="relative mt-6 min-h-0 flex-1 overflow-y-auto">
                <PostmanTeamSelector
                    nextHref={nextHref}
                    postmanTeamId={postmanTeamId}
                    postmanCollectionId={postmanCollectionId}
                />
                <div
                    className={cn(
                        "pointer-events-none sticky inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent",
                        "transition-opacity",
                        isOverflowing ? "opacity-100" : "opacity-0"
                    )}
                />
            </div>
            <div className="shrink-0 pt-2">
                <div className="flex items-center gap-4 my-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => setMode("create-new")}>
                    Create a new org
                </Button>
            </div>
        </div>
    );
}
