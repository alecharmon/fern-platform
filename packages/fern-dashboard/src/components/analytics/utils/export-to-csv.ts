import type { ConversationRow } from "../types";
import { getLocationDisplayText } from "./get-location-display-text";

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

export function exportToCSV(conversations: ConversationRow[], filename: string = "conversations-export") {
    const headers = ["Conversation ID", "First Query", "Channel", "Messages", "Date"];

    const rows = conversations.map((conversation) => {
        const isoDate = new Date(conversation.created_at).toISOString();
        const channel = getLocationDisplayText(conversation.source);
        return [
            escapeCSVField(conversation.conversation_id),
            escapeCSVField(conversation.first_query),
            escapeCSVField(channel),
            conversation.message_count.toString(),
            isoDate
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
