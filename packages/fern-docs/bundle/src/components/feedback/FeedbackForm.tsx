"use client";

import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernCheckbox } from "@fern-docs/components/FernCheckbox";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernInput } from "@fern-docs/components/FernInput";
import { FernRadioGroup } from "@fern-docs/components/FernRadioGroup";
import { FernTextarea } from "@fern-docs/components/FernTextarea";
import { t } from "@fern-docs/i18n";
import { useKeyboardPress } from "@fern-ui/react-commons";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { type FC, type FormEvent, useCallback, useMemo, useRef, useState } from "react";

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
    lang: string;
}

const SHOW_EMAIL_INPUT_ATOM = atomWithStorage<boolean | "indeterminate">("feedback-show-email-input", false);
const EMAIL_ATOM = atomWithStorage<string>("feedback-email", "");

const FEEDBACK_FORM_REASON_ID = "feedback-reason";

export const FeedbackForm: FC<FeedbackFormProps> = ({ isHelpful, onSubmit, layoutDensity = "verbose", lang }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [feedbackId, setFeedbackId] = useState<string>();
    const [feedbackMessage, setFeedbackMessage] = useState<string>("");
    const [showEmailInput, setShowEmailInput] = useAtom(SHOW_EMAIL_INPUT_ATOM);
    const [email, setEmail] = useAtom(EMAIL_ATOM);

    const legend =
        isHelpful === "yes"
            ? t(lang).feedback.whatDidYouLike
            : isHelpful === "no"
              ? t(lang).feedback.whatWentWrong
              : t(lang).feedback.feedback;
    const feedbackOptions = useMemo<FernDropdown.Option[]>(() => {
        const options =
            isHelpful === "yes" ? POSITIVE_FEEDBACK(lang) : isHelpful === "no" ? NEGATIVE_FEEDBACK(lang) : [];
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
                            placeholder={`(Optional) ${t(lang).feedback.tellUsMoreAboutExperience}`}
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
                label: t(lang).feedback.anotherReason,
                children: (active) =>
                    active ? (
                        <FernTextarea
                            ref={textareaRef}
                            autoFocus={true}
                            className="mt-2 w-full"
                            placeholder={t(lang).feedback.tellUsMoreAboutExperience}
                            onValueChange={setFeedbackMessage}
                            value={feedbackMessage}
                        />
                    ) : null
            });
        }
        return transformedOptions;
    }, [isHelpful, feedbackMessage, layoutDensity, lang]);

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
                    placeholder={t(lang).feedback.helpUsImproveDocs}
                    onValueChange={setFeedbackMessage}
                    value={feedbackMessage}
                />
            )}

            {layoutDensity === "verbose" && (
                <>
                    <hr className="border-border-default my-4" />

                    <div className="mt-4">
                        <FernCheckbox
                            label={t(lang).feedback.yesOkayToFollowUp}
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
                {t(lang).feedback.feedback}
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

export const POSITIVE_FEEDBACK = (lang: string): FeedbackItem[] => [
    {
        feedbackId: "accurate",
        title: t(lang).feedbackQuality.accurate,
        description: t(lang).feedbackQuality.accuratelyDescribes,
        satisfied: true
    },
    {
        feedbackId: "solved-my-issue",
        title: t(lang).feedback.solvedMyIssue,
        description: t(lang).feedback.helpedMeResolveIssue,
        satisfied: true
    },
    {
        feedbackId: "easy-to-understand",
        title: t(lang).feedbackQuality.easyToUnderstand,
        description: t(lang).feedbackQuality.easyToFollowAndComprehend,
        satisfied: true
    },
    {
        feedbackId: "product-adoption",
        title: t(lang).feedback.helpedMeDecideToUse,
        description: t(lang).feedback.convincedMeToAdopt,
        satisfied: true
    }
];

export const NEGATIVE_FEEDBACK = (lang: string): FeedbackItem[] => [
    {
        feedbackId: "inaccurate",
        title: t(lang).feedbackQuality.inaccurate,
        description: t(lang).feedback.doesntAccuratelyDescribe,
        satisfied: false
    },
    {
        feedbackId: "hard-to-follow",
        title: t(lang).feedback.couldntFindWhatLookingFor,
        description: t(lang).feedback.missingImportantInfo,
        satisfied: true
    },
    {
        feedbackId: "hard-to-understand",
        title: t(lang).feedbackQuality.hardToUnderstand,
        description: t(lang).feedback.tooComplicatedOrUnclear,
        satisfied: true
    },
    {
        feedbackId: "code-sample-errors",
        title: t(lang).feedback.codeSampleErrors,
        description: t(lang).feedback.oneOrMoreCodeSamplesIncorrect,
        satisfied: true
    }
];
