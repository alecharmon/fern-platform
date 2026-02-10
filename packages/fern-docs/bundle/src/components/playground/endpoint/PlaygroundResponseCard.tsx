import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { ExpandCodeButton } from "@fern-docs/components/ExpandCodeButton";
import { FernAudioPlayer } from "@fern-docs/components/FernAudioPlayer";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernCard } from "@fern-docs/components/FernCard";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useIsDarkCode } from "@fern-docs/components/state/dark-code";
import { t } from "@fern-docs/i18n";
import { type Loadable, visitLoadable } from "@fern-ui/loadable";
import { round } from "es-toolkit/math";
import { Download } from "lucide-react";
import type { ReactElement } from "react";
import { ErrorBoundaryFallback } from "@/components/error-boundary";
import { randomUUID } from "@/components/util/randomUUID";
import { PlaygroundResponsePreview } from "../PlaygroundResponsePreview";
import { PlaygroundSendRequestButton } from "../PlaygroundSendRequestButton";
import type { PlaygroundResponse } from "../types/playgroundResponse";
import type { ProxyResponse } from "../types/proxy";

interface PlaygroundResponseCard {
    response: Loadable<PlaygroundResponse>;
    sendRequest: () => void;
    requestDisabled: boolean;
    lang: string;
}

export function PlaygroundResponseCard({
    response,
    sendRequest,
    requestDisabled,
    lang
}: PlaygroundResponseCard): ReactElement<any> {
    const isDarkCode = useIsDarkCode();
    return (
        <FernCard
            className={cn("fern-explorer-response-card rounded-3 flex min-w-0 flex-1 shrink flex-col overflow-hidden", {
                "bg-card-solid dark": isDarkCode
            })}
        >
            <div className="fern-explorer-response-header border-border-default flex h-10 w-full shrink-0 items-center justify-between border-b px-3 py-2">
                <span className="fern-explorer-response-title text-(color:--grayscale-a11) text-xs uppercase">
                    {t(lang).apiReference.response}
                </span>

                {response.type === "loaded" && (
                    <div className="flex items-center gap-2 text-xs">
                        <span
                            className={cn("rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono", {
                                ["bg-(color:--accent-a3) text-(color:--accent-a11)"]:
                                    response.value.response.status >= 200 && response.value.response.status < 300,
                                ["bg-(color:--red-a3) text-(color:--red-a11)"]: response.value.response.status > 300
                            })}
                        >
                            {t(lang).apiReference.statusLower}: {response.value.response.status}
                        </span>
                        <span
                            className={
                                "bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono"
                            }
                        >
                            {t(lang).apiReference.timeLower}: {round(response.value.time, 2)}ms
                        </span>
                        {response.value.type === "json" &&
                            response.value.size != null &&
                            response.value.size.trim().length > 0 && (
                                <span
                                    className={
                                        "bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono"
                                    }
                                >
                                    {t(lang).apiReference.size}: {response.value.size}b
                                </span>
                            )}
                    </div>
                )}

                {visitLoadable(response, {
                    loading: () => <div />,
                    loaded: (response) =>
                        response.type === "file" ? (
                            <FernTooltipProvider>
                                <FernTooltip content={t(lang).buttons.downloadFile}>
                                    <FernButton
                                        icon={<Download />}
                                        size="small"
                                        variant="minimal"
                                        onClick={() => {
                                            const a = document.createElement("a");
                                            a.href = response.response.body;
                                            a.download = createFilename(response.response, response.contentType);
                                            a.click();
                                        }}
                                    />
                                </FernTooltip>
                            </FernTooltipProvider>
                        ) : (
                            <div className="flex items-center gap-2">
                                <ExpandCodeButton
                                    content={() =>
                                        response.type === "json"
                                            ? JSON.stringify(response.response.body, null, 2)
                                            : response.type === "stream"
                                              ? response.response.body
                                              : ""
                                    }
                                    language="json"
                                    lang={lang}
                                />
                                <CopyToClipboardButton
                                    content={() =>
                                        response.type === "json"
                                            ? JSON.stringify(response.response.body, null, 2)
                                            : response.type === "stream"
                                              ? response.response.body
                                              : ""
                                    }
                                    className="-mr-2"
                                    lang={lang}
                                />
                            </div>
                        ),
                    failed: () => (
                        <span className="bg-(color:--red-a3) text-(color:--red-a11) rounded-1 flex items-center p-1 font-mono text-xs uppercase leading-none">
                            {t(lang).apiReference.failed}
                        </span>
                    )
                })}
            </div>
            {visitLoadable(response, {
                loading: () =>
                    response.type === "notStartedLoading" ? (
                        <div className="flex flex-1 items-center justify-center">
                            <PlaygroundSendRequestButton
                                sendRequest={sendRequest}
                                disabled={requestDisabled}
                                lang={lang}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-1 items-center justify-center">{t(lang).status.loading}</div>
                    ),
                loaded: (response) => {
                    // Handle text-based content
                    if (
                        response.type !== "file" ||
                        response.contentType.startsWith("text") ||
                        response.contentType.startsWith("application/xml")
                    ) {
                        return <PlaygroundResponsePreview response={response} />;
                    }

                    // Handle audio content
                    if (response.contentType.startsWith("audio/")) {
                        return (
                            <FernAudioPlayer
                                src={response.response.body}
                                className="flex h-full items-center justify-center p-4"
                            />
                        );
                    }

                    // Handle PDF content
                    if (response.contentType.includes("application/pdf")) {
                        return (
                            <iframe
                                src={response.response.body}
                                className="size-full"
                                title={t(lang).status.pdfPreview}
                                allowFullScreen
                            />
                        );
                    }

                    // Handle JSON content type

                    try {
                        JSON.parse(JSON.stringify(response.response.body));
                        return <PlaygroundResponsePreview response={response} />;
                    } catch {
                        // If JSON parsing fails, continue to next handler
                    }

                    // Handle 204 status
                    if (response.response.status === 204) {
                        return <PlaygroundResponsePreview response={response} />;
                    }

                    // Default case - unsupported file type
                    return (
                        <ErrorBoundaryFallback
                            error={new Error(`File preview not supported for ${response.contentType}`)}
                            lang={lang}
                        />
                    );
                },
                failed: (e) => {
                    console.error(`[playground-response-card] ${JSON.stringify(e)}`);
                    return <ErrorBoundaryFallback error={new Error(String(e))} lang={lang} />;
                }
            })}
        </FernCard>
    );
}

function createFilename(body: ProxyResponse.SerializableFileBody, contentType: string): string {
    const headers = new Headers(body.headers);
    const contentDisposition = headers.get("Content-Disposition");

    if (contentDisposition != null) {
        const filename = contentDisposition.split("filename=")[1];
        if (filename != null) {
            return filename;
        }
    }

    // TODO: use a more deterministic way to generate filenames
    const extension = contentType.split("/")[1];
    return `${randomUUID()}.${extension}`;
}
