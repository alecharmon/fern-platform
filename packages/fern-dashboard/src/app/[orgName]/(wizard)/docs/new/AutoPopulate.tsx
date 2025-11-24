"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { type BrandFetchResponse, getBrandFetchAssets } from "@/app/actions/getBrandFetchAssets";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { uploadOnboardingAsset } from "./api";
import type { WizardFormData } from "./page";

interface AutoPopulateProps {
    wizardFormData: WizardFormData;
    setWizardFormData: (data: WizardFormData) => void;
}

export default function AutoPopulate({ wizardFormData, setWizardFormData }: AutoPopulateProps) {
    const orgName = useOrgNameFromPathname();
    const [domain, setDomain] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Downloads an image from a URL and returns it as a File object
     */
    const downloadImageAsFile = useCallback(async (url: string, filename: string): Promise<File> => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type });
    }, []);

    const getIconItem = useCallback((logos: BrandFetchResponse["logos"]) => {
        const icon = logos
            ?.find((logo) => logo.type === "icon")
            ?.formats.find((iconFormat) => iconFormat?.format !== "svg");
        if (icon) {
            return icon;
        }
        const logoItem = logos?.find((logo) => logo.type === "logo")?.formats.find((format) => format.format !== "svg");
        if (logoItem) {
            return logoItem;
        }
        const remainingItem = logos
            ?.find((logo) => logo.formats.find((format) => format.format !== "svg"))
            ?.formats.find((format) => format.format !== "svg");
        if (remainingItem) {
            return remainingItem;
        }
        return null;
    }, []);

    const handleAutoPopulate = useCallback(async () => {
        if (!domain.trim()) {
            setError("Please enter a domain");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await getBrandFetchAssets(domain);

            if (!result.success) {
                setError(result.error);
                return;
            }

            const brandData = result.data;
            const updates: Partial<WizardFormData> = {};

            // Auto-populate site name if available
            if (brandData.name) {
                updates.docsSiteName = brandData.name;
                // Convert name to URL-friendly format
                const urlFriendly = brandData.name
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
                updates.docsSiteUrl = urlFriendly;
                updates.docsSiteUrlAvailable = null; // Reset availability check
            }

            const iconItem = getIconItem(brandData.logos);

            // Auto-populate logo - download first logo and upload to S3
            // Prefer logos with non-transparent backgrounds
            console.log("$$$");
            if (iconItem) {
                const logoUrl = iconItem.src || "";

                console.log({
                    iconItem,
                    logoUrl,
                    format: iconItem.format,
                    logos: brandData.logos
                });

                try {
                    // Download the logo
                    const logoFile = await downloadImageAsFile(logoUrl, `logo.${iconItem?.format || "png"}`);
                    console.log({ logoFile });

                    // Upload to S3
                    const { assetUrl } = await uploadOnboardingAsset(logoFile, orgName);
                    console.log({ assetUrl });
                    updates.logoUrl = assetUrl;

                    // Also use as favicon if not set
                    console.log("faviconUrl", assetUrl);
                    updates.faviconUrl = assetUrl;
                } catch (logoError) {
                    console.error("Failed to download/upload logo:", logoError);
                    // Fallback to direct URL
                    updates.logoUrl = logoUrl;
                    updates.faviconUrl = logoUrl;
                }
            }

            // Auto-populate primary color - use first color as accent
            if (brandData.colors && brandData.colors.length > 0) {
                let colorToUse =
                    brandData.colors.find((color) => color.type === "accent") ||
                    brandData.colors.find((color) => color.type === "brand");
                colorToUse = colorToUse || brandData.colors[0];
                if (colorToUse) {
                    updates.primaryColorHex = colorToUse.hex;
                }
            }

            // Apply all updates
            if (Object.keys(updates).length > 0) {
                setWizardFormData({
                    ...wizardFormData,
                    ...updates
                });
            }
        } catch (err) {
            console.error("Error auto-populating from BrandFetch:", err);
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, [domain, orgName, wizardFormData, setWizardFormData, downloadImageAsFile, getIconItem]);

    // Debounce effect - auto-fetch after user stops typing
    // biome-ignore lint/correctness/useExhaustiveDependencies: handleAutoPopulate causes infinite re-renders if included
    useEffect(() => {
        if (!domain.trim()) {
            return;
        }

        const timeoutId = setTimeout(() => {
            void handleAutoPopulate();
        }, 800); // 800ms delay

        return () => clearTimeout(timeoutId);
    }, [domain]);

    return (
        <div className="flex flex-col gap-5 rounded-md border border-gray-500 bg-gray-300 p-3">
            <div className="flex items-center justify-center gap-2">
                <SparklesIcon className="text-gray-1100 h-4 w-4" />
                <h3 className="text-gray-1200 text-sm font-normal">Auto-populate branding</h3>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="company-site" className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">
                    Your company site (optional)
                </Label>
                <div className="relative">
                    <Input
                        id="company-site"
                        type="text"
                        placeholder="myorg.com"
                        value={domain}
                        onChange={(e) => {
                            setDomain(e.target.value);
                            setError(null);
                        }}
                        disabled={isLoading}
                        className="dark:bg-b w-full bg-gray-200 pr-10"
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2Icon className="h-4 w-4 animate-spin text-gray-800" />
                        </div>
                    )}
                </div>
                {isLoading && <p className="text-gray-1100 text-xs">Fetching brand assets...</p>}
                {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>
        </div>
    );
}
