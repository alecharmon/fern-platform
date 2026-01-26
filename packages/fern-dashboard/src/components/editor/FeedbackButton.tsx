"use client";

import { CornerDownLeft, MessageSquare } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { type FeedbackType, sendEditorFeedback } from "@/app/actions/sendEditorFeedback";
import { getPylon } from "@/components/pylon/getPylon";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isMac } from "@/utils/tiptap-utils";
import { TextArea } from "../ui/textarea";
import { DashboardTooltip } from "./DashboardTooltip";

interface FeedbackButtonProps {
    userEmail?: string;
    orgName?: string;
    docsUrl?: string;
}

export function FeedbackButton({ userEmail, orgName, docsUrl }: FeedbackButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [feedbackType, setFeedbackType] = useState<FeedbackType>("feature-request");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!feedback.trim()) {
            return;
        }

        setIsSubmitting(true);

        try {
            await sendEditorFeedback({ feedback, feedbackType, userEmail, orgName, docsUrl });
        } catch (error) {
            toast.error("Failed to send feedback. Please try again.");
            console.error("Failed to send feedback:", error);
        }

        setFeedback("");
        setFeedbackType("feature-request");
        setIsOpen(false);
        setIsSubmitting(false);
    }, [feedback, feedbackType, userEmail, orgName, docsUrl]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSubmit();
            } else if (e.key === "Escape") {
                e.preventDefault();
                setIsOpen(false);
            }
        },
        [handleSubmit]
    );

    const openPylonChat = () => {
        getPylon()?.("show");
        getPylon()?.("showChatBubble");
    };

    const shortcutKey = isMac() ? "⌘" : "Ctrl";
    const isFeatureRequest = feedbackType === "feature-request";

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <DashboardTooltip content="Send feedback">
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="py-2 mx-2 h-7">
                        <MessageSquare className="size-4" />
                        Feedback
                    </Button>
                </PopoverTrigger>
            </DashboardTooltip>
            <PopoverContent className="w-80" align="end">
                <div className="flex flex-col gap-3">
                    <RadioGroup value={feedbackType} onValueChange={(value) => setFeedbackType(value as FeedbackType)}>
                        <label className="flex cursor-pointer items-center gap-2">
                            <RadioGroupItem value="feature-request" />
                            <span className="text-sm">Feature request</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                            <RadioGroupItem value="bug-report" />
                            <span className="text-sm">Bug report</span>
                        </label>
                    </RadioGroup>
                    <TextArea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-[100px] resize-none"
                        placeholder={isFeatureRequest ? "Ideas to improve Fern Editor..." : "Describe the issue..."}
                        autoFocus
                    />
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        Send
                        <div className="flex items-center gap-1">
                            <Kbd className="size-5">{shortcutKey}</Kbd>
                            <Kbd className="size-5">
                                <CornerDownLeft className="size-3" />
                            </Kbd>
                        </div>
                    </Button>
                    <p className="text-muted-foreground text-center text-xs">
                        Need help?{" "}
                        <button type="button" onClick={openPylonChat} className="fern-link cursor-pointer">
                            Chat with us
                        </button>{" "}
                        or{" "}
                        <a
                            href="https://buildwithfern.com/learn/home"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fern-link"
                        >
                            see docs
                        </a>
                        .
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
}
