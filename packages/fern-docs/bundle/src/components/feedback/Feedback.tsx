"use client";

import { getFaiOrigin } from "@fern-api/docs-server";
import { FernAIClient } from "@fern-api/fai-sdk";
import { Button } from "@fern-docs/components/button";
import { cn } from "@fern-docs/components/cn";
import { toast } from "@fern-docs/components/FernToast";
import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import { t } from "@fern-docs/i18n";
import { useKeyboardPress } from "@fern-ui/react-commons";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { track } from "../analytics";
import { registerPosthogProperties } from "../analytics/posthog";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackFormDialog } from "./FeedbackFormDialog";

export const ASKFERN_FEEDBACK_PREPEND = "[Ask Fern] ";

export interface FeedbackProps {
    className?: string;
    type?: string;
    feedbackQuestion?: string;
    metadata?: Record<string, unknown> | (() => Record<string, unknown>);
    pathname?: string;
    feedbackSource?: string;
    lang: string;
    copyAction?: React.ReactNode;
}

export const Feedback: FC<FeedbackProps> = ({
    className,
    feedbackQuestion,
    type = "on-page-feedback",
    metadata,
    pathname: pathnameProp,
    feedbackSource,
    lang,
    copyAction
}) => {
    const [sent, setSent] = useState(false);
    const [isHelpful, setIsHelpful] = useState<"yes" | "no" | undefined>();
    const [showFeedbackInput, setShowFeedbackInput] = useState(false);
    const defaultFeedbackQuestion = feedbackQuestion ?? t(lang).feedback.wasThisPageHelpful;

    const faiClient = new FernAIClient({
        baseUrl: getFaiOrigin()
    });

    const ref = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const currentPathname = useCurrentPathname();
    const pathname = pathnameProp ?? currentPathname;

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when pathname changes
    useEffect(() => {
        setSent(false);
        setIsHelpful(undefined);
        setShowFeedbackInput(false);
    }, [pathname]);

    const handleYes = () => {
        setIsHelpful("yes");
        setShowFeedbackInput(true);
        textareaRef.current?.focus();
        track("feedback_voted", {
            satisfied: true,
            feedbackQuestion: defaultFeedbackQuestion,
            type,
            ...(typeof metadata === "function" ? metadata() : metadata)
        });
    };
    const handleNo = () => {
        setIsHelpful("no");
        setShowFeedbackInput(true);
        textareaRef.current?.focus();
        track("feedback_voted", {
            satisfied: false,
            feedbackQuestion: defaultFeedbackQuestion,
            type,
            ...(typeof metadata === "function" ? metadata() : metadata)
        });
    };

    const handleSubmitFeedback = useCallback(
        ({
            feedbackId,
            feedbackMessage,
            email,
            showEmailInput
        }: {
            feedbackId: string;
            feedbackMessage: string;
            email: string;
            showEmailInput: boolean | "indeterminate";
        }) => {
            registerPosthogProperties({ email });
            if (feedbackSource === "ask-fern") {
                const metadataObj = typeof metadata === "function" ? metadata() : metadata;
                const domain = metadataObj?.domain as string;
                const conversationId = metadataObj?.conversationId as string;
                const queryId = metadataObj?.queryId as string;
                if (domain != null && conversationId != null) {
                    try {
                        void faiClient.feedback.createFeedback(domain, {
                            conversation_id: conversationId,
                            query_id: queryId,
                            domain,
                            is_helpful: isHelpful === "yes",
                            feedback_message: feedbackMessage,
                            user_email: email
                        });
                    } catch (error) {
                        console.log(`Error creating conversation feedback: ${error}`);
                    }
                }
            }
            const feedbackPrepend = feedbackSource === "ask-fern" ? ASKFERN_FEEDBACK_PREPEND : "";
            track("feedback_submitted", {
                // satisfied must be a boolean because it's how the zapier integration is set
                satisfied: isHelpful === "yes" ? true : isHelpful === "no" ? false : undefined,
                feedback: feedbackId,
                message: feedbackPrepend + feedbackMessage,
                email,
                allowFollowUpViaEmail: showEmailInput === true,
                feedbackQuestion: defaultFeedbackQuestion,
                type,
                ...(typeof metadata === "function" ? metadata() : metadata)
            });
            toast.success(t(lang).feedback.thankYouForFeedback);
            setSent(true);
        },
        [isHelpful, metadata, defaultFeedbackQuestion, feedbackSource, type, faiClient.feedback.createFeedback, lang]
    );

    useKeyboardPress({
        key: "Escape",
        onPress: useCallback(() => {
            if (textareaRef.current !== document.activeElement && showFeedbackInput) {
                setShowFeedbackInput(false);
            }
        }, [showFeedbackInput])
    });

    return (
        <div className={className} ref={ref}>
            {!sent ? (
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        {copyAction}
                        <FeedbackFormDialog
                            content={
                                isHelpful && (
                                    <FeedbackForm isHelpful={isHelpful} onSubmit={handleSubmitFeedback} lang={lang} />
                                )
                            }
                            trigger={
                                <Button
                                    variant={isHelpful === "yes" ? "success" : "ghost"}
                                    onClick={handleYes}
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                >
                                    <ThumbsUp
                                        className={cn("h-4 w-4", {
                                            "animate-thumb-rock": isHelpful === "yes"
                                        })}
                                    />
                                </Button>
                            }
                        />
                        <FeedbackFormDialog
                            content={
                                isHelpful && (
                                    <FeedbackForm isHelpful={isHelpful} onSubmit={handleSubmitFeedback} lang={lang} />
                                )
                            }
                            trigger={
                                <Button
                                    variant={isHelpful === "no" ? "destructive" : "ghost"}
                                    onClick={handleNo}
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                >
                                    <ThumbsDown
                                        className={cn("h-4 w-4", {
                                            "animate-thumb-rock": isHelpful === "no"
                                        })}
                                    />
                                </Button>
                            }
                        />
                    </div>
                </div>
            ) : (
                <div className="flex h-6 items-center">
                    <span className="text-(color:--grayscale-a11) text-xs">{t(lang).feedback.thankYouForFeedback}</span>
                </div>
            )}
        </div>
    );
};
