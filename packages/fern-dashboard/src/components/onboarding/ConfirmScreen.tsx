"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CopyableText } from "@/components/ui/CopyableText";
import type { WizardFormData } from "@/providers/OnboardingProvider";

import { CodeWidget } from "./CodeWidget";

interface ConfirmScreenProps {
    orgName: string;
    docsUrl: string;
    wizardFormData: WizardFormData;
}

export function ConfirmScreen({ orgName, docsUrl, wizardFormData }: ConfirmScreenProps) {
    const fullUrl = `${docsUrl}.docs.buildwithfern.com`;
    const encodedURI = encodeURIComponent(docsUrl);

    return (
        <div className="flex min-h-screen w-full flex-col px-8 pt-16">
            <div className="mx-auto mb-6 w-[430px] flex flex-col justify-center items-center gap-5">
                <h1 className="text-2xl font-semibold">Your site is live!</h1>

                <div className="flex items-center gap-2">
                    <CopyableText text={fullUrl} successMessage="URL copied to clipboard!" variant="innerCopy" />

                    <Button asChild variant="default" size="sm" className="h-[36px] bg-primary">
                        <a
                            href={`https://${fullUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5"
                        >
                            View site
                            <ArrowUpRightIcon className="size-3.5" />
                        </a>
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/${orgName}/docs/${encodedURI}.docs.buildwithfern.com`}>Go to Dashboard</Link>
                    </Button>
                </div>
            </div>

            {/* CodeWidget with fade effect */}
            <div
                className="flex pt-10 w-full items-center justify-center"
                style={{
                    transform: "perspective(1200px) rotateX(10deg) rotateY(15deg) rotateZ(-10deg) translateX(35px)",
                    transformStyle: "preserve-3d",
                    maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)"
                }}
            >
                <CodeWidget wizardFormData={wizardFormData} />
            </div>
        </div>
    );
}
