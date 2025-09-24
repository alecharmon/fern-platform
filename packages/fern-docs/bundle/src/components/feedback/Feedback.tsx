"use client";

import { FC, useCallback, useEffect, useRef, useState } from "react";

import { ThumbsDown, ThumbsUp } from "lucide-react";

import { getFaiOrigin } from "@fern-api/docs-server";
import { FernAIClient } from "@fern-api/fai-sdk";
import { Button, cn } from "@fern-docs/components";
import { toast } from "@fern-docs/components";
import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import { useKeyboardPress } from "@fern-ui/react-commons";

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
}

export const Feedback: FC<FeedbackProps> = ({
  className,
  feedbackQuestion = "Was this page helpful?",
  type = "on-page-feedback",
  metadata,
  pathname: pathnameProp,
  feedbackSource,
}) => {
  const [sent, setSent] = useState(false);
  const [isHelpful, setIsHelpful] = useState<"yes" | "no" | undefined>();
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  const faiClient = new FernAIClient({
    baseUrl: getFaiOrigin(),
  });

  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentPathname = useCurrentPathname();
  const pathname = pathnameProp ?? currentPathname;

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
      feedbackQuestion,
      type,
      ...(typeof metadata === "function" ? metadata() : metadata),
    });
  };
  const handleNo = () => {
    setIsHelpful("no");
    setShowFeedbackInput(true);
    textareaRef.current?.focus();
    track("feedback_voted", {
      satisfied: false,
      feedbackQuestion,
      type,
      ...(typeof metadata === "function" ? metadata() : metadata),
    });
  };

  const handleSubmitFeedback = useCallback(
    ({
      feedbackId,
      feedbackMessage,
      email,
      showEmailInput,
    }: {
      feedbackId: string;
      feedbackMessage: string;
      email: string;
      showEmailInput: boolean | "indeterminate";
    }) => {
      registerPosthogProperties({ email });
      if (feedbackSource === "ask-fern") {
        const metadataObj =
          typeof metadata === "function" ? metadata() : metadata;
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
              user_email: email,
            });
          } catch (error) {
            console.log(`Error creating conversation feedback: ${error}`);
          }
        }
      }
      const feedbackPrepend =
        feedbackSource === "ask-fern" ? ASKFERN_FEEDBACK_PREPEND : "";
      track("feedback_submitted", {
        // satisfied must be a boolean because it's how the zapier integration is set
        satisfied:
          isHelpful === "yes" ? true : isHelpful === "no" ? false : undefined,
        feedback: feedbackId,
        message: feedbackPrepend + feedbackMessage,
        email,
        allowFollowUpViaEmail: showEmailInput === true,
        feedbackQuestion,
        type,
        ...(typeof metadata === "function" ? metadata() : metadata),
      });
      toast.success("Thank you for submitting feedback!");
      setSent(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHelpful, metadata, feedbackQuestion, feedbackSource, type]
  );

  useKeyboardPress({
    key: "Escape",
    onPress: useCallback(() => {
      if (textareaRef.current !== document.activeElement && showFeedbackInput) {
        setShowFeedbackInput(false);
      }
    }, [showFeedbackInput]),
  });

  return (
    <div className={className} ref={ref}>
      {!sent ? (
        <div className="flex flex-wrap items-center justify-start gap-4">
          <span className="text-(color:--grayscale-a11) text-sm font-medium">
            {feedbackQuestion}
          </span>
          <div className="flex gap-2">
            <FeedbackFormDialog
              content={
                isHelpful && (
                  <FeedbackForm
                    isHelpful={isHelpful}
                    onSubmit={handleSubmitFeedback}
                  />
                )
              }
              trigger={
                <Button
                  variant={isHelpful === "yes" ? "outlineSuccess" : "outline"}
                  onClick={handleYes}
                  size="sm"
                >
                  <ThumbsUp
                    className={cn({
                      "animate-thumb-rock": isHelpful === "yes",
                    })}
                  />
                  Yes
                </Button>
              }
            />
            <FeedbackFormDialog
              content={
                isHelpful && (
                  <FeedbackForm
                    isHelpful={isHelpful}
                    onSubmit={handleSubmitFeedback}
                  />
                )
              }
              trigger={
                <Button
                  variant={isHelpful === "no" ? "outlineDanger" : "outline"}
                  onClick={handleNo}
                  size="sm"
                >
                  <ThumbsDown
                    className={cn({
                      "animate-thumb-rock": isHelpful === "no",
                    })}
                  />
                  No
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="flex h-6 items-center">
          <span className="text-(color:--grayscale-a11) text-xs">
            Thank you for your feedback!
          </span>
        </div>
      )}
    </div>
  );
};
