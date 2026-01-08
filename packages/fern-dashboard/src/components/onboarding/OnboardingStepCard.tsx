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
        <div className="flex w-full flex-col max-w-[600px]">
            {/* Main content area */}
            <div className="mx-auto flex max-h-[calc(100vh-150px)] w-full flex-1 flex-col overflow-y-auto px-8 py-12 md:rounded-t-2xl md:px-20 md:pt-20">
                <div className="w-full">
                    <SlideLeftTransition>
                        <div className="space-y-8 pb-24">
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
            <div className="absolute bottom-0 left-0 w-full border-t border-border p-4 bg-background">
                <SlideUpTransition>
                    <div className="w-full space-y-2 max-w-[450px] mx-auto">
                        {error && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                                {error}
                            </div>
                        )}

                        {/* Continue button */}
                        <Button
                            onClick={handleContinue}
                            variant="default"
                            className="w-full"
                            size="lg"
                            disabled={continueDisabled || isLoading || isProcessing}
                        >
                            {continueText}
                        </Button>

                        {/* Skip button */}
                        {showSkip && (
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
        </div>
    );
}
