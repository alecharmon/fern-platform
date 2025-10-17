export function getLocationDisplayText(source: string | undefined): string {
    if (source === "SLACK") {
        return "Slack";
    }
    if (source === "CHAT") {
        return "Docs";
    }
    return source ?? "";
}
