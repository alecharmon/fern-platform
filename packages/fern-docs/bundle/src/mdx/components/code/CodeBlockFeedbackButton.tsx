"use client";

import { Button } from "@fern-docs/components/button";
import { cn } from "@fern-docs/components/cn";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import * as Popover from "@radix-ui/react-popover";
import { Flag } from "lucide-react";
import { useState } from "react";

import { track } from "@/components/analytics";

export declare namespace CodeBlockFeedbackButton {
    export interface Props {
        className?: string;
        code?: string;
        language?: string;
        disableAnalytics?: boolean;
        activeTab?: {
            title: string;
            index: number;
            language?: string;
        };
    }
}

export const CodeBlockFeedbackButton: React.FC<CodeBlockFeedbackButton.Props> = ({
    className,
    code,
    language,
    disableAnalytics,
    activeTab
}) => {
    const [isOpen, setIsOpen] = useState(false);

    if (code == null) {
        return null;
    }

    const handleFeedbackSubmit = (feedback: { message: string; code: string; language?: string }) => {
        if (disableAnalytics) {
            return;
        }
        track("code_block_feedback_submitted", {
            message: feedback.message,
            language: feedback.language,
            code: feedback.code,
            ...(activeTab && {
                activeTabTitle: activeTab.title,
                activeTabIndex: activeTab.index,
                ...(activeTab.language && { activeTabLanguage: activeTab.language })
            })
        });
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            if (disableAnalytics) {
                return;
            }
            track("code_block_feedback_opened", {
                language,
                code,
                ...(activeTab && {
                    activeTabTitle: activeTab.title,
                    activeTabIndex: activeTab.index,
                    ...(activeTab.language && { activeTabLanguage: activeTab.language })
                })
            });
        }
    };

    return (
        <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Popover.Trigger asChild>
                <span className="inline-flex">
                    <FernTooltipProvider>
                        <FernTooltip content="Report incorrect code">
                            <Button
                                className={cn("fern-feedback-button", className)}
                                variant="ghost"
                                size="iconSm"
                                aria-label="Report incorrect code"
                            >
                                <Flag />
                            </Button>
                        </FernTooltip>
                    </FernTooltipProvider>
                </span>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    className={cn(
                        "bg-card-solid border-border-default rounded-2 z-50 w-[calc(100vw-32px)] border p-4 shadow-xl backdrop-blur-xl sm:w-96",
                        "data-[state=open]:data-[side=bottom]:animate-slide-up-and-fade data-[state=open]:data-[side=left]:animate-slide-right-and-fade data-[state=open]:data-[side=right]:animate-slide-left-and-fade data-[state=open]:data-[side=top]:animate-slide-down-and-fade will-change-[transform,opacity]"
                    )}
                >
                    <CodeBlockFeedbackForm
                        code={code}
                        language={language}
                        onClose={() => setIsOpen(false)}
                        onSubmit={handleFeedbackSubmit}
                    />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};

interface CodeBlockFeedbackFormProps {
    code: string;
    language?: string;
    onClose: () => void;
    onSubmit?: (feedback: { message: string; code: string; language?: string }) => void;
}

const CodeBlockFeedbackForm: React.FC<CodeBlockFeedbackFormProps> = ({ code, language, onClose, onSubmit }) => {
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) {
            return;
        }

        setIsSubmitting(true);
        try {
            onSubmit?.({ message, code, language });
            onClose();
            setMessage("");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <h2 className="text-lg font-semibold mb-4">Report incorrect code</h2>
            <p className="text-(color:--grayscale-a11) text-sm mb-4">
                Help us improve our documentation by reporting what&apos;s wrong with this code example.
            </p>
            <form onSubmit={handleSubmit}>
                <textarea
                    className="bg-card-background border-border-default rounded-2 w-full border p-3 text-sm focus:outline-none"
                    rows={4}
                    placeholder="What's wrong with this code example?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    autoFocus
                />
                <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="default" disabled={!message.trim() || isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </Button>
                </div>
            </form>
        </div>
    );
};
