import type { FeedbackEntry } from "@/app/actions/getFeedback";

function escapeCSVField(value: string): string {
    const normalized = value.replace(/\r/g, "\\r").replace(/\n/g, "\\n");

    if (
        normalized.includes('"') ||
        normalized.includes(",") ||
        normalized.includes("\n") ||
        normalized.includes("\r")
    ) {
        return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
}

export function exportFeedbackToCSV(feedback: FeedbackEntry[], filename: string = "feedback-export"): void {
    const headers = [
        "Date",
        "Current URL",
        "Was Helpful",
        "Reason",
        "User Feedback",
        "Channel",
        "Location",
        "Device",
        "Browser",
        "Operating System"
    ];

    const rows = feedback.map((entry) => {
        const isoDate = new Date(entry.date).toISOString();

        // Format selection (reason)
        const selection = entry.selection.replaceAll("-", " ");
        const sentenceCased = selection.charAt(0).toUpperCase() + selection.slice(1).toLowerCase();

        // Format channel
        let channel = entry.userFeedback || "-";
        if (channel.trim() === "[Ask Fern]") {
            channel = "Ask Fern";
        } else if (channel === "-") {
            channel = "Docs";
        }

        return [
            isoDate,
            escapeCSVField(entry.currentUrl),
            entry.wasHelpful ? "True" : "False",
            escapeCSVField(sentenceCased),
            escapeCSVField(entry.userFeedback || "-"),
            escapeCSVField(channel),
            escapeCSVField(entry.location),
            escapeCSVField(entry.device),
            escapeCSVField(entry.browser),
            escapeCSVField(entry.operatingSystem)
        ];
    });

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
