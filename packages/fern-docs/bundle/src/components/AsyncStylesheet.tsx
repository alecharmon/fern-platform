"use client";

/**
 * AsyncStylesheet - Non-blocking CSS loading component
 *
 * Loads a stylesheet asynchronously without blocking page render.
 * Uses the media="print" + onLoad trick for optimal performance while
 * maintaining React/TypeScript compatibility.
 */

interface AsyncStylesheetProps {
    href: string;
    crossOrigin?: "anonymous" | "use-credentials";
}

export function AsyncStylesheet({ href, crossOrigin = "anonymous" }: AsyncStylesheetProps) {
    return (
        <>
            {/* Preload hint for early resource discovery */}
            <link rel="preload" as="style" href={href} crossOrigin={crossOrigin} />

            {/* Async loading with media swap trick - React's onLoad works here */}
            <link
                rel="stylesheet"
                href={href}
                media="print"
                crossOrigin={crossOrigin}
                onLoad={(e) => {
                    (e.target as HTMLLinkElement).media = "all";
                }}
            />

            {/* Fallback for users with JavaScript disabled */}
            <noscript
                dangerouslySetInnerHTML={{
                    __html: `<link rel="stylesheet" href="${href}" crossorigin="${crossOrigin}" />`
                }}
            />
        </>
    );
}
