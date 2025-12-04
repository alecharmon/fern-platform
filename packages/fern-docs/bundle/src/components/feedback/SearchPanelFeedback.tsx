"use client";

import { getFaiOrigin } from "@fern-api/docs-server";
import { FernAIClient } from "@fern-api/fai-sdk";
import { Button } from "@fern-docs/components/button";
import { cn } from "@fern-docs/components/cn";
import { toast } from "@fern-docs/components/FernToast";
import { t } from "@fern-docs/i18n";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { type FC, useCallback, useState } from "react";
import { track } from "../analytics";
import { registerPosthogProperties } from "../analytics/posthog";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackFormDialog } from "./FeedbackFormDialog";

export interface SearchPanelFeedbackProps {
    className?: string;
    metadata: () => Record<string, unknown>;
    lang: string;
    copyAction?: React.ReactNode;
}

export const SearchPanelFeedback: FC<SearchPanelFeedbackProps> = ({ className, metadata, lang, copyAction }) => {
    const [sent, setSent] = useState(false);
    const [isHelpful, setIsHelpful] = useState<"yes" | "no" | undefined>();

    const faiClient = new FernAIClient({
        baseUrl: getFaiOrigin()
    });

    const handleYes = () => {
        setIsHelpful("yes");
        track("feedback_voted", {
            satisfied: true,
            type: "ask-fern-feedback",
            ...metadata()
        });
    };

    const handleNo = () => {
        setIsHelpful("no");
        track("feedback_voted", {
            satisfied: false,
            type: "ask-fern-feedback",
            ...metadata()
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

            const metadataObj = metadata();
            const domain = metadataObj.domain as string;
            const conversationId = metadataObj.conversationId as string;
            const queryId = metadataObj.queryId as string;

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

            track("feedback_submitted", {
                satisfied: isHelpful === "yes",
                feedback: feedbackId,
                message: feedbackMessage,
                email,
                allowFollowUpViaEmail: showEmailInput === true,
                type: "ask-fern-feedback",
                ...metadataObj
            });

            toast.success(t(lang).feedback.thankYouForFeedback);
            setSent(true);
        },
        [isHelpful, metadata, faiClient.feedback, lang]
    );

    return (
        <div className={className}>
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
