"use client";

/**
 * A placeholder displayed when media (images, videos, iframes) fails to load
 * in an airgapped environment. Shows an SVG icon with a message indicating
 * that the media was blocked by the network.
 */
export function MediaBlockedPlaceholder({ type = "media" }: { type?: "image" | "video" | "iframe" | "media" }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "8px",
                padding: "24px 16px",
                borderRadius: "8px",
                backgroundColor: "var(--grayscale-a3, #f5f5f5)",
                border: "1px dashed var(--grayscale-a6, #d4d4d4)",
                color: "var(--grayscale-a11, #6b6b6b)",
                fontSize: "13px",
                lineHeight: "1.4",
                textAlign: "center",
                minHeight: "80px",
                width: "100%"
            }}
        >
            <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                {/* Cloud with a slash through it */}
                <path d="M2 2l20 20" />
                <path d="M9.4 5.2A7 7 0 0 1 18 9a5 5 0 0 1 4 8.2" />
                <path d="M5.7 5.7A7 7 0 0 0 4 9a5 5 0 0 0 .5 9.5h12" />
            </svg>
            <span>{`${type.charAt(0).toUpperCase() + type.slice(1)} blocked by network`}</span>
        </div>
    );
}
