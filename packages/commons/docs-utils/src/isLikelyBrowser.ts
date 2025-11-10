const browserPatterns = [/chrome/i, /firefox/i, /safari/i, /edg/i, /opera/i, /brave/i];

export function isLikelyBrowser(userAgent: string | null | undefined): boolean {
    if (!userAgent) {
        return false;
    }
    const ua = userAgent.toLowerCase();

    // must contain "mozilla" for real browsers (legacy requirement),
    // and match one of the browser patterns
    return ua.includes("mozilla") && browserPatterns.some((p) => p.test(ua));
}
