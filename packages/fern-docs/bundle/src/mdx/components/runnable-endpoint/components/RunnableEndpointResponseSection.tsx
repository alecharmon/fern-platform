import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { t } from "@fern-docs/i18n";
import type { Loadable } from "@fern-ui/loadable";
import { round } from "es-toolkit/math";
import { ChevronDown } from "lucide-react";
import type { PlaygroundResponse } from "@/components/playground/types/playgroundResponse";
import { RunnableEndpointResponsePreview } from "./RunnableEndpointResponsePreview";

interface RunnableEndpointResponseSectionProps {
    response: Loadable<PlaygroundResponse>;
    isExpanded: boolean;
    onToggle: () => void;
    lang: string;
}

export function RunnableEndpointResponseSection({
    response,
    isExpanded,
    onToggle,
    lang
}: RunnableEndpointResponseSectionProps) {
    if (response.type === "notStartedLoading") {
        return null;
    }

    return (
        <div className="fern-runnable-response flex flex-col">
            <button
                type="button"
                onClick={onToggle}
                className="fern-runnable-response-header border-border-default flex h-10 w-full shrink-0 cursor-pointer items-center justify-between border-b px-3 py-2 hover:bg-tag-default/50"
            >
                <div className="fern-runnable-response-label flex items-center gap-2">
                    <ChevronDown
                        className={cn("size-4 transition-transform", {
                            "-rotate-90": !isExpanded
                        })}
                    />
                    <span className="text-(color:--grayscale-a11) text-xs uppercase">
                        {t(lang).apiReference.response}
                    </span>
                </div>

                {response.type === "loaded" && (
                    <div className="fern-runnable-response-meta flex items-center gap-2 text-xs">
                        <span
                            className={cn(
                                "fern-runnable-response-status rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono",
                                {
                                    "bg-(color:--accent-a3) text-(color:--accent-a11)":
                                        response.value.response.status >= 200 && response.value.response.status < 300,
                                    "bg-(color:--red-a3) text-(color:--red-a11)": response.value.response.status >= 300
                                }
                            )}
                        >
                            {t(lang).apiReference.statusLower}
                            {": "}
                            {response.value.response.status}
                        </span>
                        <span className="fern-runnable-response-time bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono">
                            {t(lang).apiReference.timeLower}
                            {": "}
                            {round(response.value.time, 2)}
                            {"ms"}
                        </span>
                        {response.value.type === "json" &&
                            response.value.size != null &&
                            response.value.size.trim().length > 0 && (
                                <span className="fern-runnable-response-size bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono">
                                    {t(lang).apiReference.size}
                                    {": "}
                                    {response.value.size}
                                    {"b"}
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
                            lang={lang}
                        />
                    </div>
                )}

                {response.type === "loading" && (
                    <span className="text-(color:--grayscale-a11) text-xs">{t(lang).status.loading}...</span>
                )}

                {response.type === "failed" && (
                    <span className="bg-(color:--red-a3) text-(color:--red-a11) rounded-1 flex items-center p-1 font-mono text-xs uppercase leading-none">
                        {t(lang).apiReference.failed}
                    </span>
                )}
            </button>

            <FernCollapse open={isExpanded}>
                {response.type === "loaded" && <RunnableEndpointResponsePreview response={response.value} />}

                {response.type === "failed" && (
                    <div className="p-4">
                        <div className="bg-(color:--red-a3) text-(color:--red-a11) rounded p-3 text-sm">
                            <strong>{t(lang).errors.error}:</strong> {String(response.error)}
                        </div>
                    </div>
                )}
            </FernCollapse>
        </div>
    );
}
