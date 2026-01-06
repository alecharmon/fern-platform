import type { BrokenLink } from "@/app/api/link-checker/types";

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

interface ExportLinkCheckerData {
    brokenLinks: BrokenLink[];
    blockedLinks: BrokenLink[];
}

export function exportLinkCheckerToCSV(data: ExportLinkCheckerData, filename: string = "link-checker-results"): void {
    const headers = ["URL", "Status", "Type", "Category", "Source Pages"];

    const brokenRows = data.brokenLinks.map((link) => {
        const status = link.statusCode?.toString() ?? link.error ?? "Error";
        const type = link.isInternal ? "Internal" : "External";
        const sourcePages = link.sourcePages.join("; ");

        return [
            escapeCSVField(link.url),
            escapeCSVField(status),
            escapeCSVField(type),
            "Broken Link",
            escapeCSVField(sourcePages)
        ];
    });

    const blockedRows = data.blockedLinks.map((link) => {
        const status = link.statusCode?.toString() ?? "403";
        const type = link.isInternal ? "Internal" : "External";
        const sourcePages = link.sourcePages.join("; ");

        return [
            escapeCSVField(link.url),
            escapeCSVField(status),
            escapeCSVField(type),
            "Blocked Link",
            escapeCSVField(sourcePages)
        ];
    });

    const allRows = [...brokenRows, ...blockedRows];
    const csvContent = [headers.join(","), ...allRows.map((row) => row.join(","))].join("\n");

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
