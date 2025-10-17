import { useCallback, useMemo } from "react";
import type { PlaygroundResponse } from "@/components/playground/types/playgroundResponse";
import { Json } from "@/mdx/components/json/JSON";

interface RunnableEndpointResponsePreviewProps {
    response: PlaygroundResponse;
}

export function RunnableEndpointResponsePreview({ response }: RunnableEndpointResponsePreviewProps) {
    const responseText = useMemo(() => {
        if (typeof response.response.body === "string") {
            return response.response.body;
        }
        return JSON.stringify(response.response.body, null, 2);
    }, [response]);

    const handleCopy = useCallback((copy: { src: unknown }) => {
        const value = copy.src;
        let textToCopy: string;

        if (typeof value === "string") {
            textToCopy = value;
        } else if (typeof value === "object" && value != null) {
            textToCopy = JSON.stringify(value, null, 2);
        } else {
            textToCopy = String(value);
        }

        navigator.clipboard.writeText(textToCopy).catch((err: unknown) => {
            console.error("Failed to copy to clipboard:", err);
        });
    }, []);

    // For JSON responses, use the interactive JSON viewer
    if (response.type === "json" && typeof response.response.body === "object") {
        return (
            <div className="runnable-endpoint-response max-h-[390px] overflow-auto p-3">
                <style>
                    {`
                        .runnable-endpoint-response .react-json-view {
                            /* Hide all copy icons by default */
                            .copy-to-clipboard-container {
                                opacity: 0;
                                position: absolute;
                                margin-left: 8px;
                                transition: opacity 0.15s ease;
                                pointer-events: none;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                vertical-align: middle;
                                min-width: 16px;
                                min-height: 16px;
                            }

                            /* Make container relative for absolute positioning of children */
                            .copy-to-clipboard-container {
                                position: relative;
                                width: 16px;
                                height: 16px;
                            }

                            /* Position both copy icon and checkmark in the same spot */
                            .copy-to-clipboard-container svg,
                            .copy-to-clipboard-container > div,
                            .copy-to-clipboard-container > span {
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                transform: translate(-50%, -50%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                width: 16px;
                                height: 16px;
                            }

                            /* Only show copy icon on direct hover of the value row */
                            .object-content > .variable-row:hover > .copy-to-clipboard-container,
                            .pushed-content > .variable-row:hover > .copy-to-clipboard-container {
                                opacity: 1;
                                pointer-events: auto;
                            }

                            /* Prevent parent hover from showing child copy icons */
                            .object-content > .variable-row:hover .object-content .copy-to-clipboard-container,
                            .pushed-content > .variable-row:hover .pushed-content .copy-to-clipboard-container {
                                opacity: 0;
                                pointer-events: none;
                            }

                            /* Re-enable for nested direct hovers */
                            .object-content > .variable-row:hover .object-content > .variable-row:hover > .copy-to-clipboard-container,
                            .pushed-content > .variable-row:hover .pushed-content > .variable-row:hover > .copy-to-clipboard-container {
                                opacity: 1;
                                pointer-events: auto;
                            }
                        }
                    `}
                </style>
                <Json
                    json={response.response.body}
                    enableFernClipboard={false}
                    jsonViewProps={
                        {
                            enableClipboard: handleCopy,
                            collapsed: 2
                        } as any
                    }
                />
            </div>
        );
    }

    // For other response types, show as text
    return (
        <div className="max-h-[390px] overflow-auto">
            <pre className="text-code-sm m-0 select-text p-4 font-mono">{responseText}</pre>
        </div>
    );
}
