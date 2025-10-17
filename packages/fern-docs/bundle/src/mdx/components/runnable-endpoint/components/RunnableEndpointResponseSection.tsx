import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import type { Loadable } from "@fern-ui/loadable";
import { round } from "es-toolkit/math";
import { ChevronDown } from "lucide-react";
import type { PlaygroundResponse } from "@/components/playground/types/playgroundResponse";
import { RunnableEndpointResponsePreview } from "./RunnableEndpointResponsePreview";

interface RunnableEndpointResponseSectionProps {
    response: Loadable<PlaygroundResponse>;
    isExpanded: boolean;
    onToggle: () => void;
}

export function RunnableEndpointResponseSection({
    response,
    isExpanded,
    onToggle
}: RunnableEndpointResponseSectionProps) {
    if (response.type === "notStartedLoading") {
        return null;
    }

    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={onToggle}
                className="border-border-default flex h-10 w-full shrink-0 cursor-pointer items-center justify-between border-b px-3 py-2 hover:bg-tag-default/50"
            >
                <div className="flex items-center gap-2">
                    <ChevronDown
                        className={cn("size-4 transition-transform", {
                            "-rotate-90": !isExpanded
                        })}
                    />
                    <span className="text-(color:--grayscale-a11) text-xs uppercase">Response</span>
                </div>

                {response.type === "loaded" && (
                    <div className="flex items-center gap-2 text-xs">
                        <span
                            className={cn("rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono", {
                                "bg-(color:--accent-a3) text-(color:--accent-a11)":
                                    response.value.response.status >= 200 && response.value.response.status < 300,
                                "bg-(color:--red-a3) text-(color:--red-a11)": response.value.response.status >= 300
                            })}
                        >
                            status: {response.value.response.status}
                        </span>
                        <span className="bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono">
                            time: {round(response.value.time, 2)}ms
                        </span>
                        {response.value.type === "json" &&
                            response.value.size != null &&
                            response.value.size.trim().length > 0 && (
                                <span className="bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono">
                                    size: {response.value.size}b
                                </span>
                            )}
                        <CopyToClipboardButton
                            content={() =>
                                response.value.type === "json"
                                    ? JSON.stringify(response.value.response.body, null, 2)
                                    : response.value.type === "stream"
                                      ? response.value.response.body
                                      : typeof response.value.response.body === "string"
                                        ? response.value.response.body
                                        : ""
                            }
                            className="-mr-2"
                        />
                    </div>
                )}

                {response.type === "loading" && (
                    <span className="text-(color:--grayscale-a11) text-xs">Loading...</span>
                )}

                {response.type === "failed" && (
                    <span className="bg-(color:--red-a3) text-(color:--red-a11) rounded-1 flex items-center p-1 font-mono text-xs uppercase leading-none">
                        Failed
                    </span>
                )}
            </button>

            <FernCollapse open={isExpanded}>
                {response.type === "loaded" && <RunnableEndpointResponsePreview response={response.value} />}

                {response.type === "failed" && (
                    <div className="p-4">
                        <div className="bg-(color:--red-a3) text-(color:--red-a11) rounded p-3 text-sm">
                            <strong>Error:</strong> {String(response.error)}
                        </div>
                    </div>
                )}
            </FernCollapse>
        </div>
    );
}
