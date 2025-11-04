"use client";

import { CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import CodeWidget from "./CodeWidget";
import type { WizardFormData } from "./page";

interface ConfirmScreenProps {
    docsUrl: string;
    wizardFormData: WizardFormData;
    fernDocsDownloadUrl?: string;
}

export default function ConfirmScreen({ docsUrl, wizardFormData, fernDocsDownloadUrl }: ConfirmScreenProps) {
    const orgName = useOrgNameFromPathname();
    const [copied, setCopied] = useState(false);
    const fullUrl = `${docsUrl}.docs.buildwithfern.com`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const encodedURI = encodeURIComponent(docsUrl);

    return (
        <div className="flex min-h-screen w-full flex-col px-8 pt-16">
            <div className="mx-auto mb-6 w-[430px] justify-center space-y-5">
                <h1 className="text-gray-1200 text-2xl font-semibold dark:text-white">Your site is live at:</h1>

                <div className="flex h-10 items-center gap-2">
                    <div className="flex h-full items-center gap-2 rounded-lg border border-gray-500 bg-white px-3 dark:bg-gray-800">
                        <span className="text-gray-1000 font-mono text-xs dark:text-gray-200">{fullUrl}</span>
                        <button
                            onClick={handleCopy}
                            className="hover:text-gray-1200 text-gray-900 transition-colors dark:text-gray-300 dark:hover:text-white"
                            aria-label="Copy URL"
                        >
                            <CopyIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <Button asChild variant="default" size="sm" className="bg-primary h-full">
                        <a
                            href={`https://${fullUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5"
                        >
                            View site
                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </a>
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/${orgName}/docs/${encodedURI}.docs.buildwithfern.com`}>Go to Fern Dashboard</Link>
                    </Button>

                    {fernDocsDownloadUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a
                                href={fernDocsDownloadUrl}
                                download={`fern-docs-${docsUrl}.zip`}
                                className="flex items-center gap-1.5"
                            >
                                <DownloadIcon className="h-3.5 w-3.5" />
                                Download Repository Code
                            </a>
                        </Button>
                    )}
                </div>
            </div>

            {/* CodeWidget with fade effect */}
            <div
                className="flex w-full items-center justify-center"
                style={{
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
