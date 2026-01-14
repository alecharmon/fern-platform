"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";

import { Button } from "@/components/ui/button";
import { CopyableText } from "@/components/ui/CopyableText";
import type { WizardFormData } from "@/providers/OnboardingProvider";
import { captureEvent, PosthogEventName } from "../posthog/events";
import { FadeInTransition } from "../transitions/FadeInTransition";
import { SlideUpTransition } from "../transitions/SlideUpTransition";
import { CodeWidget } from "./CodeWidget";

interface ConfirmScreenProps {
    orgName: string;
    docsUrl: string;
    wizardFormData: WizardFormData;
}

export function ConfirmScreen({ orgName, docsUrl, wizardFormData }: ConfirmScreenProps) {
    const fullUrl = `${docsUrl}.docs.buildwithfern.com`;
    const encodedURI = encodeURIComponent(docsUrl);
    const posthog = usePostHog();

    const handleViewSiteClick = () => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_COMPLETE_ACTION, {
            action: "view_site",
            docsSiteUrl: docsUrl
        });
    };

    const handleContinueToSetupClick = () => {
        captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_COMPLETE_ACTION, {
            action: "continue_to_setup",
            docsSiteUrl: docsUrl
        });
    };

    return (
        <div className="flex w-full flex-col pt-24 h-screen">
            <FadeInTransition>
                <div className="mx-auto w-[430px] flex flex-col justify-center items-center gap-5">
                    <h1 className="text-2xl font-semibold">Your site is live!</h1>

                    <div className="flex items-center gap-2">
                        <CopyableText
                            text={fullUrl}
                            successMessage="URL copied to clipboard!"
                            variant="innerCopy"
                            className="px-3 text-sm font-mono text-muted-foreground min-w-fit"
                        />

                        <Button asChild variant="outline" size="sm" className="h-[36px] bg-primary">
                            <a
                                href={`https://${fullUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5"
                                onClick={handleViewSiteClick}
                            >
                                View site
                                <ArrowUpRightIcon className="size-3.5" />
                            </a>
                        </Button>
                    </div>
                    <Button asChild variant="outline">
                        <Link
                            href={`/${orgName}/docs/${encodedURI}.docs.buildwithfern.com`}
                            onClick={handleContinueToSetupClick}
                        >
                            Continue to setup
                        </Link>
                    </Button>
                </div>
            </FadeInTransition>

            {/* CodeWidget with fade effect */}
            <div className="flex-1 pt-6 flex w-full items-center justify-center overflow-hidden">
                <SlideUpTransition>
                    <div
                        style={{
                            transform:
                                "perspective(1200px) rotateX(10deg) rotateY(15deg) rotateZ(-10deg) translateX(35px)",
                            transformStyle: "preserve-3d",
                            maskImage:
                                "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                            WebkitMaskImage:
                                "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)"
                        }}
                    >
                        <CodeWidget wizardFormData={wizardFormData} />
                    </div>
                </SlideUpTransition>
            </div>
        </div>
    );
}
