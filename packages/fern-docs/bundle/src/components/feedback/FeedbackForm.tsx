"use client";

import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernCheckbox } from "@fern-docs/components/FernCheckbox";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernInput } from "@fern-docs/components/FernInput";
import { FernRadioGroup } from "@fern-docs/components/FernRadioGroup";
import { FernTextarea } from "@fern-docs/components/FernTextarea";
import { useKeyboardPress } from "@fern-ui/react-commons";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { type FC, type FormEvent, useCallback, useMemo, useRef, useState } from "react";

import { i18n } from "@/constants";

const MotionFernRadioGroup = m.create(FernRadioGroup);

interface FeedbackFormProps {
    isHelpful: "yes" | "no";
    onSubmit: (feedback: {
        feedbackId: string;
        feedbackMessage: string;
        email: string;
        showEmailInput: boolean | "indeterminate";
    }) => void;
    layoutDensity?: "condensed" | "verbose";
}

const SHOW_EMAIL_INPUT_ATOM = atomWithStorage<boolean | "indeterminate">("feedback-show-email-input", false);
const EMAIL_ATOM = atomWithStorage<string>("feedback-email", "");

const FEEDBACK_FORM_REASON_ID = "feedback-reason";

export const FeedbackForm: FC<FeedbackFormProps> = ({ isHelpful, onSubmit, layoutDensity = "verbose" }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [feedbackId, setFeedbackId] = useState<string>();
    const [feedbackMessage, setFeedbackMessage] = useState<string>("");
    const [showEmailInput, setShowEmailInput] = useAtom(SHOW_EMAIL_INPUT_ATOM);
    const [email, setEmail] = useAtom(EMAIL_ATOM);

    const legend =
        isHelpful === "yes"
            ? i18n.feedback.whatDidYouLike
            : isHelpful === "no"
              ? i18n.feedback.whatWentWrong
              : i18n.feedback.feedback;
    const feedbackOptions = useMemo<FernDropdown.Option[]>(() => {
        const options = isHelpful === "yes" ? POSITIVE_FEEDBACK : isHelpful === "no" ? NEGATIVE_FEEDBACK : [];
        const transformedOptions: FernDropdown.Option[] = options.map(
            (option): FernDropdown.Option => ({
                type: "value",
                value: option.feedbackId,
                label: option.title,
                helperText: layoutDensity === "verbose" && option.description,
                children: (active) =>
                    active && layoutDensity === "verbose" ? (
                        <FernTextarea
                            ref={textareaRef}
                            // autoFocus={true}
                            className="mt-2 w-full"
                            placeholder={`(Optional) ${i18n.feedback.tellUsMoreAboutExperience}`}
                            onValueChange={setFeedbackMessage}
                            value={feedbackMessage}
                        />
                    ) : null
            })
        );

        if (transformedOptions.length > 0 && layoutDensity === "verbose") {
            transformedOptions.push({
                type: "value",
                value: "other",
                label: i18n.feedback.anotherReason,
                children: (active) =>
                    active ? (
                        <FernTextarea
                            ref={textareaRef}
                            autoFocus={true}
                            className="mt-2 w-full"
                            placeholder={i18n.feedback.tellUsMoreAboutExperience}
                            onValueChange={setFeedbackMessage}
                            value={feedbackMessage}
                        />
                    ) : null
            });
        }
        return transformedOptions;
    }, [isHelpful, feedbackMessage, layoutDensity]);

    useKeyboardPress({
        key: "Escape",
        onPress: useCallback((e) => {
            if (textareaRef.current === document.activeElement) {
                textareaRef.current?.blur();
                e.stopImmediatePropagation();
            }
        }, []),
        capture: true
    });

    const handleSubmitFeedback = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (feedbackId == null) {
            return;
        }
        onSubmit({
            feedbackId,
            feedbackMessage,
            email,
            showEmailInput
        });
    };

    return (
        <form onSubmit={handleSubmitFeedback} className="p-0">
            <label
                htmlFor={FEEDBACK_FORM_REASON_ID}
                className={cn({
                    "text-lg font-semibold": layoutDensity === "verbose",
                    "text-(color:--grayscale-a11) text-sm font-medium": layoutDensity === "condensed"
                })}
            >
                {legend}
            </label>

            {feedbackOptions.length > 0 ? (
                <LazyMotion features={domAnimation} strict>
                    <MotionFernRadioGroup
                        layoutId={legend}
                        id={FEEDBACK_FORM_REASON_ID}
                        className="mt-4"
                        value={feedbackId}
                        onValueChange={setFeedbackId}
                        options={feedbackOptions}
                        autoFocus={true}
                        compact={layoutDensity === "condensed"}
                    />
                </LazyMotion>
            ) : (
                <FernTextarea
                    ref={textareaRef}
                    className="mt-2 w-full"
                    placeholder={i18n.feedback.helpUsImproveDocs}
                    onValueChange={setFeedbackMessage}
                    value={feedbackMessage}
                />
            )}

            {layoutDensity === "verbose" && (
                <>
                    <hr className="border-border-default my-4" />

                    <div className="mt-4">
                        <FernCheckbox
                            label={i18n.feedback.yesOkayToFollowUp}
                            checked={showEmailInput}
                            onCheckedChange={setShowEmailInput}
                            autoFocus={false}
                        >
                            {showEmailInput && (
                                <FernInput
                                    className="mt-2"
                                    type="email"
                                    placeholder="yourname@email.com"
                                    value={email}
                                    onValueChange={setEmail}
                                />
                            )}
                        </FernCheckbox>
                    </div>
                </>
            )}

            <FernButton
                full={true}
                intent="primary"
                className="rounded-3/2 mt-4"
                type="submit"
                disabled={feedbackId == null}
                size={layoutDensity === "verbose" ? "large" : "normal"}
            >
                {i18n.feedback.feedback}
            </FernButton>
        </form>
    );
};

interface FeedbackItem {
    feedbackId: string;
    title: string;
    description: string;
    satisfied: boolean;
}

export const POSITIVE_FEEDBACK: FeedbackItem[] = [
    {
        feedbackId: "accurate",
        title: i18n.feedbackQuality.accurate,
        description: i18n.feedbackQuality.accuratelyDescribes,
        satisfied: true
    },
    {
        feedbackId: "solved-my-issue",
        title: i18n.feedback.solvedMyIssue,
        description: i18n.feedback.helpedMeResolveIssue,
        satisfied: true
    },
    {
        feedbackId: "easy-to-understand",
        title: i18n.feedbackQuality.easyToUnderstand,
        description: i18n.feedbackQuality.easyToFollowAndComprehend,
        satisfied: true
    },
    {
        feedbackId: "product-adoption",
        title: i18n.feedback.helpedMeDecideToUse,
        description: i18n.feedback.convincedMeToAdopt,
        satisfied: true
    }
];

export const NEGATIVE_FEEDBACK: FeedbackItem[] = [
    {
        feedbackId: "inaccurate",
        title: i18n.feedbackQuality.inaccurate,
        description: i18n.feedback.doesntAccuratelyDescribe,
        satisfied: false
    },
    {
        feedbackId: "hard-to-follow",
        title: i18n.feedback.couldntFindWhatLookingFor,
        description: i18n.feedback.missingImportantInfo,
        satisfied: true
    },
    {
        feedbackId: "hard-to-understand",
        title: i18n.feedbackQuality.hardToUnderstand,
        description: i18n.feedback.tooComplicatedOrUnclear,
        satisfied: true
    },
    {
        feedbackId: "code-sample-errors",
        title: i18n.feedback.codeSampleErrors,
        description: i18n.feedback.oneOrMoreCodeSamplesIncorrect,
        satisfied: true
    }
];
