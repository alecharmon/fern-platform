"use client";

import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { checkDocsUrlAvailability } from "@/app/actions/docsWizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DocsUrlProps {
    value: string;
    onChange: (value: string, available: boolean) => void;
}

export function DocsUrl({ value, onChange }: DocsUrlProps) {
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: onChange is intentionally omitted to prevent infinite loop
    useEffect(() => {
        // Reset validation state when input changes
        setIsAvailable(null);
        setErrorMessage(null);

        if (!localValue) {
            return;
        }

        const validateSubdomain = (val: string): string | null => {
            if (val.length > 63) {
                return "Subdomain must be 63 characters or fewer.";
            }
            if (!/^[a-z0-9-_]+$/.test(val)) {
                return "Use lowercase letters, numbers, underscores,and hyphens only.";
            }
            if (/--/.test(val)) {
                return "Consecutive hyphens are not allowed.";
            }
            if (/^[-_]|[-_]$/.test(val)) {
                return "Cannot start or end with a hyphen or underscore.";
            }
            return null;
        };

        const validationError = validateSubdomain(localValue);
        if (validationError) {
            setErrorMessage(validationError);
            onChange(localValue, false);
            return;
        }

        // Debounce the API call
        const timeoutId = setTimeout(async () => {
            setIsChecking(true);
            try {
                const result = await checkDocsUrlAvailability(localValue);

                if (result.error) {
                    setErrorMessage(result.error);
                    setIsAvailable(false);
                    onChange(localValue, false);
                } else {
                    setIsAvailable(result.available);
                    if (!result.available) {
                        setErrorMessage("This URL has already been claimed; try again.");
                    }
                    onChange(localValue, result.available);
                }
            } catch (error) {
                console.error("Error checking URL availability:", error);
                setErrorMessage("Failed to check URL availability");
                setIsAvailable(false);
            } finally {
                setIsChecking(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [localValue]);

    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor="docs-url" className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">
                URL
            </Label>
            <div className="flex items-center gap-2">
                <Input
                    id="docs-url"
                    type="text"
                    placeholder="docs.myorg.com"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    className="w-full"
                />
                <span className="text-foreground flex items-center gap-2 whitespace-nowrap text-sm">
                    .docs.buildwithfern.com
                    {isChecking && <Loader2Icon className="h-4 w-4 animate-spin text-gray-900" />}
                    {!isChecking && isAvailable === false && <XIcon className="h-4 w-4 text-red-600" />}
                    {!isChecking && isAvailable === true && <CheckIcon className="text-primary h-4 w-4" />}
                </span>
            </div>
            {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
    );
}
