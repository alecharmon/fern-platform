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

export default function DocsUrl({ value, onChange }: DocsUrlProps) {
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
                    onChange(localValue, true);
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
            <Label htmlFor="docs-url" className="text-sm font-medium text-gray-1200">
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
                <span className="flex items-center gap-2 text-sm text-foreground whitespace-nowrap">
                    .docs.buildwithfern.com
                    {isChecking && <Loader2Icon className="h-4 w-4 animate-spin text-gray-900" />}
                    {!isChecking && isAvailable === false && <XIcon className="h-4 w-4 text-red-600" />}
                    {!isChecking && isAvailable === true && <CheckIcon className="h-4 w-4 text-primary" />}
                </span>
            </div>
            {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
    );
}
