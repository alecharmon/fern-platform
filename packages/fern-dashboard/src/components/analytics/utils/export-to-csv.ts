import { FernAI } from "@fern-api/fai-sdk";

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

export function exportToCSV(
  queries: FernAI.Query[],
  filename: string = "queries-export"
) {
  const headers = ["Conversation ID", "Date", "Role", "Query"];

  const rows = queries.map((query) => {
    const isoDate = new Date(query.created_at).toISOString();
    return [
      escapeCSVField(query.conversation_id),
      isoDate,
      escapeCSVField(query.role),
      escapeCSVField(query.text),
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}-${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
