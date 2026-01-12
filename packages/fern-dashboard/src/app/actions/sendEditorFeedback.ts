"use server";

import { postToSlackImmediate } from "@fern-api/docs-server/slack";

export type FeedbackType = "feature-request" | "bug-report";

interface SendEditorFeedbackResult {
    success: boolean;
    error?: string;
}

export async function sendEditorFeedback({
    feedback,
    feedbackType,
    userEmail,
    orgName,
    docsUrl
}: {
    feedback: string;
    feedbackType: FeedbackType;
    userEmail?: string;
    orgName?: string;
    docsUrl?: string;
}): Promise<SendEditorFeedbackResult> {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback) {
        return { success: false, error: "Feedback cannot be empty" };
    }

    const typeLabel = feedbackType === "bug-report" ? ":bug: Bug Report" : ":hammer_and_wrench: Feature Request";
    const userInfo = userEmail ? ` from: *<mailto:${userEmail}|${userEmail}>*` : "";
    const contextInfo =
        orgName || docsUrl ? `\nOrg: *${orgName ?? "unknown"}* | Site: \`${docsUrl ?? "unknown"}\`` : "";
    const message = `*${typeLabel}*${userInfo}${contextInfo}\n\n${trimmedFeedback}`;

    const result = await postToSlackImmediate("#dashboard-feedback", message, "editor-feedback");

    if (!result.success) {
        console.error("Failed to send feedback to Slack:", result.error);
        if (result.error === "no-token") {
            return { success: false, error: "Slack is not configured" };
        }
        return { success: false, error: "Failed to send feedback" };
    }

    return { success: true };
}
