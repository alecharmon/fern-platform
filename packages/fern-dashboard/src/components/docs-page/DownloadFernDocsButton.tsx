"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface DownloadFernDocsButtonProps {
    docsUrl: string;
}

export function DownloadFernDocsButton({ docsUrl }: DownloadFernDocsButtonProps) {
    const [exists, setExists] = useState<boolean | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if the fern docs zip exists on mount
    useEffect(() => {
        async function checkExists() {
            try {
                const response = await fetch("/api/onboarding-assets/fern-docs-download", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ docsUrl })
                });

                if (!response.ok) {
                    throw new Error("Failed to check if fern docs exist");
                }

                const data = await response.json();
                setExists(data.exists);
            } catch (err) {
                console.error("Error checking fern docs existence:", err);
                setExists(false);
            }
        }

        void checkExists();
    }, [docsUrl]);

    const handleDownload = async () => {
        setIsDownloading(true);
        setError(null);

        try {
            // Get a fresh signed URL
            const response = await fetch("/api/onboarding-assets/fern-docs-download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ docsUrl })
            });

            if (!response.ok) {
                throw new Error("Failed to get download URL");
            }

            const data = await response.json();

            if (!data.exists || !data.downloadUrl) {
                throw new Error("Fern docs not found");
            }

            // Trigger the download by opening the signed URL
            const link = document.createElement("a");
            link.href = data.downloadUrl;
            link.download = `fern-docs-${docsUrl}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Error downloading fern docs:", err);
            setError(err instanceof Error ? err.message : "Failed to download");
        } finally {
            setIsDownloading(false);
        }
    };

    // Don't render anything while checking existence
    if (exists === null) {
        return null;
    }

    // Don't render if the zip doesn't exist
    if (!exists) {
        return null;
    }

    return (
        <div className="flex w-fit flex-col gap-2">
            <p>Code</p>
            <Button
                onClick={handleDownload}
                disabled={isDownloading}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5"
            >
                {isDownloading ? (
                    <>
                        <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                        Downloading...
                    </>
                ) : (
                    <>
                        <DownloadIcon className="h-3.5 w-3.5" />
                        Download Repo
                    </>
                )}
            </Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}
