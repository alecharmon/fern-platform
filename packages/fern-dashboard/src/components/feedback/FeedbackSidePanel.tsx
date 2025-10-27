import { MessageSquareIcon, X } from "lucide-react";

import type { FeedbackEntry } from "@/app/actions/getFeedback";

import { Button } from "../ui/button";

interface FeedbackSidePanelProps {
    feedback: FeedbackEntry;
    onClose: () => void;
}

export function FeedbackSidePanel({ feedback, onClose }: FeedbackSidePanelProps) {
    const sentenceCasedSelection =
        feedback.selection.replaceAll("-", " ").charAt(0).toUpperCase() +
        feedback.selection.replaceAll("-", " ").slice(1).toLowerCase();

    const channel = feedback.userFeedback?.startsWith("[Ask Fern]") ? "Ask Fern" : "Docs";
    const message = feedback.userFeedback?.startsWith("[Ask Fern] ")
        ? feedback.userFeedback.slice(11)
        : feedback.userFeedback?.trim() === "[Ask Fern]"
          ? ""
          : feedback.userFeedback;

    return (
        <div className="flex w-full flex-col p-0 lg:p-4">
            <div className="flex items-start justify-between pb-4">
                <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center">
                        <MessageSquareIcon className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-semibold">Feedback Details</h2>
                        <div className="text-sm text-gray-900">
                            {new Date(feedback.date).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric"
                            })}
                        </div>
                    </div>
                </div>
                <Button onClick={onClose} variant="ghost" size="iconSm">
                    <X className="h-6 w-6" />
                </Button>
            </div>
            <div className="flex flex-1 flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <h3 className="text-gray-1100 text-sm" style={{ fontFamily: "Berkeley Mono, monospace" }}>
                        Current URL
                    </h3>
                    <a
                        href={feedback.currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-1100 text-sm hover:underline"
                    >
                        {feedback.currentUrl}
                    </a>
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-gray-1100 text-sm" style={{ fontFamily: "Berkeley Mono, monospace" }}>
                        Was this page helpful?
                    </h3>
                    <p className="text-sm">{feedback.wasHelpful ? "Yes" : "No"}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-gray-1100 text-sm" style={{ fontFamily: "Berkeley Mono, monospace" }}>
                        {feedback.wasHelpful ? "What did the user like?" : "What went wrong for the user?"}
                    </h3>
                    <p className="text-sm">{sentenceCasedSelection}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-gray-1100 text-sm" style={{ fontFamily: "Berkeley Mono, monospace" }}>
                        Channel
                    </h3>
                    <p className="text-sm">{channel}</p>
                </div>

                {message && (
                    <div className="flex flex-col gap-2">
                        <h3 className="text-gray-1100 text-sm" style={{ fontFamily: "Berkeley Mono, monospace" }}>
                            User Message
                        </h3>
                        <p className="whitespace-pre-wrap text-sm">{message}</p>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <h3 className="text-gray-1100 text-sm" style={{ fontFamily: "Berkeley Mono, monospace" }}>
                        Location
                    </h3>
                    <p className="text-sm">{feedback.location}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <h3 className="text-gray-1100 text-sm" style={{ fontFamily: "Berkeley Mono, monospace" }}>
                        Device Information
                    </h3>
                    <div className="text-sm">
                        <p>Device: {feedback.device}</p>
                        <p>Browser: {feedback.browser}</p>
                        <p>Operating System: {feedback.operatingSystem}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
