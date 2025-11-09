import type { ReactNode } from "react";

// Regex to match URLs (http, https, and www) excluding trailing punctuation
const URL_REGEX = /(https?:\/\/[^\s]*[^\s.,;:!?)\]}'"<>]|www\.[^\s]*[^\s.,;:!?)\]}'"<>])/g;

/**
 * Converts text with URLs into React elements with clickable links.
 * URLs will open in a new tab.
 */
export function linkifyText(text: string): ReactNode {
    if (!text) {
        return text;
    }

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset the regex
    URL_REGEX.lastIndex = 0;

    while ((match = URL_REGEX.exec(text)) !== null) {
        const url = match[0];
        const index = match.index;

        // Add text before the URL
        if (index > lastIndex) {
            parts.push(text.substring(lastIndex, index));
        }

        // Add the URL as a clickable link
        const href = url.startsWith("www.") ? `https://${url}` : url;
        parts.push(
            <a
                key={`${url}-${index}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-primary hover:underline"
                onClick={(e) => e.stopPropagation()} // Prevent dropdown from closing
            >
                {url}
            </a>
        );

        lastIndex = index + url.length;
    }

    // Add remaining text after the last URL
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    // If no URLs were found, return the original text
    if (parts.length === 0) {
        return text;
    }

    return <>{parts}</>;
}
