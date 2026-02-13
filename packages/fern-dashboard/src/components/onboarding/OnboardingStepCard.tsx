"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SlideLeftTransition } from "../transitions/SlideLeftTransition";
import { SlideUpTransition } from "../transitions/SlideUpTransition";

interface OnboardingStepCardProps {
    title: string;
    description?: string;
    children: ReactNode;
    onContinue?: () => void | Promise<void>;
    onSkip?: () => void | Promise<void>;
    showSkip?: boolean;
    hasData?: boolean;
    continueDisabled?: boolean;
    continueText?: string;
    skipText?: string;
    isLoading?: boolean;
    error?: string | null;
}

export function OnboardingStepCard({
    title,
    description,
    children,
    onContinue,
    onSkip,
    showSkip = true,
    hasData,
    continueDisabled = false,
    continueText = "Continue",
    skipText = "Skip this step",
    isLoading = false,
    error
}: OnboardingStepCardProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced wrapper for button clicks to prevent double-clicks
    const createDebouncedHandler = useCallback(
        (handler?: () => void | Promise<void>) => {
            if (!handler) {
                return undefined;
            }

            return async () => {
                // Prevent concurrent executions
                if (isProcessing) {
                    return;
                }

                setIsProcessing(true);

                // Clear any existing timeout
                if (processingTimeoutRef.current) {
                    clearTimeout(processingTimeoutRef.current);
                }

                try {
                    await handler();
                } finally {
                    // Reset processing state after a short delay
                    processingTimeoutRef.current = setTimeout(() => {
                        setIsProcessing(false);
                    }, 300);
                }
            };
        },
        [isProcessing]
    );

    const handleContinue = createDebouncedHandler(onContinue);
    const handleSkip = createDebouncedHandler(onSkip);
    return (
        <div className="flex w-full flex-col max-w-[550px] overflow-y-hidden h-full md:px-12 justify-center">
            {/* Main content area */}
            <div className="flex max-h-[calc(100vh-150px)] w-full flex-col overflow-y-auto p-7 lg:px-8 md:rounded-t-2xl">
                <div className="w-full">
                    <SlideLeftTransition>
                        <div className="space-y-8">
                            {/* Header */}
                            <div className="space-y-2">
                                <h1 className="text-gray-1200 text-2xl font-semibold">{title}</h1>
                                {description && <p className="text-gray-1100 text-sm">{description}</p>}
                            </div>
                            {/* Step content */}
                            {children}
                        </div>
                    </SlideLeftTransition>
                </div>
            </div>

            {/* Footer with action buttons */}
            <SlideUpTransition>
                <div className="w-full space-y-2 px-7 lg:px-8">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    {/* Continue button - hidden when showSkip is enabled and user has no data */}
                    {(!showSkip || hasData !== false) && (
                        <Button
                            onClick={handleContinue}
                            variant="default"
                            className="w-full"
                            size="lg"
                            disabled={continueDisabled || isLoading || isProcessing}
                        >
                            {continueText}
                        </Button>
                    )}

                    {/* Skip button - only shown when showSkip is enabled and user has no data */}
                    {showSkip && !hasData && (
                        <Button
                            onClick={handleSkip}
                            variant="outline"
                            className="w-full"
                            size="lg"
                            disabled={isLoading || isProcessing}
                        >
                            {skipText}
                        </Button>
                    )}
                </div>
            </SlideUpTransition>
        </div>
    );
}
