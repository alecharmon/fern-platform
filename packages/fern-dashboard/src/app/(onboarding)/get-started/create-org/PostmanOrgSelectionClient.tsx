"use client";

import { useRouter } from "@bprogress/next/app";
import { motion } from "framer-motion";
import Image from "next/image";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CreateOrganizationForm } from "@/components/auth/CreateOrganizationForm";
import { PostmanTeamSelector } from "@/components/auth/PostmanTeamSelector";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { cn } from "@/utils/utils";

const easeTransition = {
    type: "tween" as const,
    ease: [0.4, 0, 0.2, 1] as const,
    duration: 0.3
};

interface PostmanOrgSelectionClientProps {
    accessToken: string;
    nextHref: string;
    initialOrgName?: string;
    postmanTeamId?: string;
    postmanTeamName?: string;
    postmanCollectionId?: string;
}

type SelectionMode = "select" | "create-new";

function PostmanIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_1858_21163)">
                <path
                    d="M15.1615 5.24754C15.1485 5.25389 15.1369 5.26275 15.1273 5.2736C15.1177 5.28444 15.1104 5.29708 15.1057 5.31078C15.101 5.32448 15.0991 5.33896 15.1 5.3534C15.101 5.36786 15.1047 5.38196 15.1112 5.39493C15.1398 5.45204 15.1511 5.51621 15.1438 5.57964C15.1365 5.64307 15.1109 5.703 15.0701 5.75214C15.0525 5.7747 15.0444 5.8032 15.0475 5.83162C15.0507 5.86002 15.0647 5.88611 15.0868 5.90433C15.1088 5.92254 15.1371 5.93149 15.1657 5.92923C15.1942 5.92698 15.2208 5.91372 15.2397 5.89226C15.3077 5.81029 15.3504 5.71034 15.3626 5.60458C15.3747 5.49883 15.3558 5.39182 15.3082 5.29658C15.2951 5.2708 15.2724 5.2512 15.245 5.24202C15.2175 5.23285 15.1875 5.23481 15.1615 5.24754Z"
                    fill="#FF6C37"
                />
                <path
                    d="M10.9311 0.562519C5.72119 -0.104351 0.955572 3.57061 0.287333 8.773C-0.380907 13.9754 3.2992 18.7313 8.5093 19.3987C13.7194 20.0661 18.4853 16.3911 19.153 11.1902C19.8208 5.9893 16.1409 1.2304 10.9311 0.562519ZM12.8894 6.48612C12.713 6.48861 12.5444 6.55974 12.4197 6.68434L8.89055 10.2069L8.13814 9.45522C11.6149 5.99258 12.2418 5.95937 12.8894 6.48612ZM9.03418 10.3326L12.5533 6.81868C12.6453 6.72698 12.7701 6.6755 12.9001 6.6755C13.0302 6.6755 13.1549 6.72698 13.247 6.81868C13.2944 6.86604 13.3316 6.92261 13.3562 6.9849C13.3809 7.04718 13.3925 7.11384 13.3903 7.18078C13.3881 7.2477 13.3722 7.31348 13.3436 7.37404C13.315 7.43459 13.2742 7.48864 13.2238 7.53285L9.49982 10.7983L9.03418 10.3326ZM9.29598 10.881L8.42414 11.0687C8.41381 11.0709 8.40303 11.0698 8.39344 11.0653C8.38382 11.061 8.37591 11.0536 8.37087 11.0443C8.36581 11.0351 8.36391 11.0244 8.36542 11.014C8.36693 11.0035 8.37181 10.9939 8.37929 10.9864L8.8903 10.476L9.29598 10.881ZM7.07379 10.518L8.00309 9.59031L8.69956 10.2856L7.13075 10.6227C7.11762 10.6255 7.10398 10.6239 7.09179 10.6183C7.07962 10.6127 7.06961 10.6033 7.0632 10.5916C7.0568 10.5798 7.05438 10.5663 7.05628 10.553C7.05819 10.5398 7.06435 10.5275 7.07379 10.518ZM4.18465 15.3134C4.17332 15.3121 4.16261 15.3076 4.15374 15.3005C4.14487 15.2934 4.13819 15.2839 4.13448 15.2731C4.13077 15.2624 4.13016 15.2508 4.13275 15.2397C4.13535 15.2286 4.14102 15.2185 4.14912 15.2105L4.89875 14.4619L5.86709 15.4286L4.18465 15.3134ZM6.10697 14.3183C6.07125 14.3367 6.04272 14.3665 6.02584 14.403C6.00897 14.4394 6.0047 14.4804 6.01374 14.5195L6.1745 15.205C6.1786 15.2259 6.17599 15.2475 6.16704 15.2668C6.15806 15.2861 6.14322 15.302 6.1246 15.3123C6.10599 15.3227 6.08458 15.3269 6.06344 15.3243C6.04231 15.3217 6.02251 15.3126 6.00693 15.2981L5.03406 14.3268L8.01468 11.3509L9.45749 11.0415L10.1499 11.7328C9.15436 12.6027 7.79419 13.4725 6.10697 14.3175V14.3183ZM10.2898 11.6058L9.6248 10.9422L13.3493 7.67622C13.3838 7.64594 13.4152 7.61222 13.443 7.5756C13.3253 8.64169 11.8346 10.1445 10.2908 11.605L10.2898 11.6058ZM13.1875 6.49241C12.9264 6.22935 12.7766 5.87607 12.7693 5.5058C12.762 5.13553 12.8977 4.77666 13.1483 4.50355C13.3989 4.23044 13.7451 4.06406 14.1152 4.03888C14.4853 4.0137 14.8509 4.13165 15.1363 4.36829L13.858 5.64468C13.8491 5.65345 13.8421 5.66389 13.8373 5.6754C13.8325 5.6869 13.83 5.69925 13.83 5.71172C13.83 5.72417 13.8325 5.73653 13.8373 5.74804C13.8421 5.75953 13.8491 5.76997 13.858 5.77874L14.8462 6.7656C14.5761 6.89871 14.2709 6.94389 13.9737 6.89475C13.6765 6.8456 13.4022 6.70461 13.1895 6.49165L13.1875 6.49241ZM15.2305 6.49241C15.1651 6.55745 15.0934 6.61592 15.0166 6.667L14.0591 5.71108L15.2743 4.49809C15.5256 4.77211 15.6613 5.13236 15.653 5.50375C15.6447 5.87516 15.4932 6.22905 15.23 6.49165L15.2305 6.49241Z"
                    fill="#FF6C37"
                />
            </g>
            <defs>
                <clipPath id="clip0_1858_21163">
                    <rect width="20" height="20" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
}

export function PostmanOrgSelectionClient({
    accessToken,
    nextHref,
    initialOrgName,
    postmanTeamId,
    postmanTeamName,
    postmanCollectionId
}: PostmanOrgSelectionClientProps) {
    const [mode, setMode] = useState<SelectionMode>("select");
    const [hasNoExistingOrgs, setHasNoExistingOrgs] = useState(false);
    const [hasOverflowAbove, setHasOverflowAbove] = useState(false);
    const [hasOverflowBelow, setHasOverflowBelow] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const posthog = usePostHog();
    const hasTrackedView = useRef(false);

    const isCreating = mode === "create-new" || hasNoExistingOrgs;

    const handleNoExistingOrgs = useCallback(() => {
        setHasNoExistingOrgs(true);
        setMode("create-new");
    }, []);

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
        const check = () => {
            setHasOverflowAbove(el.scrollTop > 0);
            setHasOverflowBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
        };
        check();
        el.addEventListener("scroll", check);
        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => {
            el.removeEventListener("scroll", check);
            observer.disconnect();
        };
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

    return (
        <div className="flex max-h-full flex-col">
            {/* Top graphic */}
            <div className="w-full overflow-hidden rounded-t-lg">
                <Image
                    src="/postman-connect-light.svg"
                    alt="Postman to Fern connection"
                    width={400}
                    height={120}
                    className="w-full h-auto block dark:hidden"
                    priority
                />
                <Image
                    src="/postman-connect-dark.svg"
                    alt="Postman to Fern connection"
                    width={400}
                    height={120}
                    className="w-full h-auto hidden dark:block"
                    priority
                />
            </div>

            {/* Heading and subtitle */}
            <h1 className="mt-6 text-2xl font-bold">Welcome to Fern</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                Connect your Postman team{" "}
                {postmanTeamName && (
                    <span className="inline rounded border border-border bg-muted px-1 py-1 font-mono text-sm font-medium text-foreground box-decoration-clone whitespace-nowrap">
                        <span className="inline-block align-middle">
                            <PostmanIcon />
                        </span>{" "}
                        {postmanTeamName}
                    </span>
                )}{" "}
                to a Fern org to publish your collection.
            </p>

            {/* When there are no existing orgs, skip the two-panel selector and show create form directly */}
            {hasNoExistingOrgs ? (
                <div className="mt-6">
                    <CreateOrganizationForm
                        accessToken={accessToken}
                        onSuccess={handleCreateSuccess}
                        submitButtonText="Continue"
                        initialOrganizationName={initialOrgName}
                        postmanTeamId={postmanTeamId}
                    />
                </div>
            ) : (
                <>
                    {/* Select an existing org container */}
                    <div
                        role={isCreating ? "button" : undefined}
                        tabIndex={isCreating ? 0 : undefined}
                        className={cn(
                            "mt-6 rounded-xl border border-border transition-colors duration-300",
                            isCreating && "cursor-pointer hover:border-foreground/20"
                        )}
                        onClick={isCreating ? () => setMode("select") : undefined}
                        onKeyDown={
                            isCreating
                                ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                          setMode("select");
                                      }
                                  }
                                : undefined
                        }
                    >
                        <motion.div
                            animate={{ justifyContent: isCreating ? "center" : "flex-start" }}
                            transition={easeTransition}
                            className="flex px-4"
                        >
                            <p className={cn("text-sm font-semibold", isCreating ? "py-3" : "pt-4 pb-4")}>
                                Select an existing org
                            </p>
                        </motion.div>
                        <motion.div
                            animate={
                                isCreating
                                    ? { height: 0, opacity: 0, overflow: "hidden" }
                                    : { height: "auto", opacity: 1, overflow: "hidden" }
                            }
                            transition={easeTransition}
                            style={{ overflow: "hidden" }}
                        >
                            <div
                                ref={scrollRef}
                                className="relative min-h-0 overflow-y-auto px-4"
                                style={{ maxHeight: 320 }}
                            >
                                <div
                                    className={cn(
                                        "pointer-events-none sticky inset-x-0 top-0 -mb-10 z-10 h-10 bg-gradient-to-b from-background to-transparent",
                                        "transition-opacity",
                                        hasOverflowAbove ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <PostmanTeamSelector
                                    nextHref={nextHref}
                                    postmanTeamId={postmanTeamId}
                                    postmanCollectionId={postmanCollectionId}
                                    onEmpty={handleNoExistingOrgs}
                                />
                                <div
                                    className={cn(
                                        "pointer-events-none sticky inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent",
                                        "transition-opacity",
                                        hasOverflowBelow ? "opacity-100" : "opacity-0"
                                    )}
                                />
                            </div>
                        </motion.div>
                    </div>

                    {/* Divider */}
                    <div className="shrink-0 py-2">
                        <div className="flex items-center gap-4 my-2">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-sm text-muted-foreground">or</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                    </div>

                    {/* Create a new org container */}
                    <div
                        role={!isCreating ? "button" : undefined}
                        tabIndex={!isCreating ? 0 : undefined}
                        className={cn(
                            "rounded-xl border border-border transition-colors duration-300",
                            !isCreating && "cursor-pointer hover:border-foreground/20"
                        )}
                        onClick={!isCreating ? () => setMode("create-new") : undefined}
                        onKeyDown={
                            !isCreating
                                ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                          setMode("create-new");
                                      }
                                  }
                                : undefined
                        }
                    >
                        <motion.div
                            animate={{ justifyContent: isCreating ? "flex-start" : "center" }}
                            transition={easeTransition}
                            className="flex px-4"
                        >
                            <p className={cn("text-sm font-semibold", isCreating ? "pt-4 pb-2" : "py-3")}>
                                Create a new org
                            </p>
                        </motion.div>
                        <motion.div
                            animate={
                                isCreating
                                    ? { height: "auto", opacity: 1, overflow: "hidden" }
                                    : { height: 0, opacity: 0, overflow: "hidden" }
                            }
                            transition={easeTransition}
                            style={{ overflow: "hidden" }}
                        >
                            <div className="px-4 pb-4">
                                <CreateOrganizationForm
                                    accessToken={accessToken}
                                    onSuccess={handleCreateSuccess}
                                    submitButtonText="Continue"
                                    initialOrganizationName={initialOrgName}
                                    postmanTeamId={postmanTeamId}
                                />
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    );
}
