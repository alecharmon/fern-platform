"use client";

import { useIsMobile, useResizeObserver } from "@fern-ui/react-commons";
import { type ReactElement, type ReactNode, useRef, useState } from "react";

import { PlaygroundSendRequestButton } from "../PlaygroundSendRequestButton";
import { PlaygroundEndpointDesktopLayout } from "./PlaygroundEndpointDesktopLayout";
import { PlaygroundEndpointMobileLayout } from "./PlaygroundEndpointMobileLayout";

interface PlaygroundEndpointContentLayoutProps {
    sendRequest: () => void;
    form: ReactNode;
    requestCard: ReactNode;
    responseCard: ReactNode;
    endpointId?: string;
    requestDisabled: boolean;
}

export function PlaygroundEndpointContentLayout({
    sendRequest,
    form,
    requestCard,
    responseCard,
    endpointId,
    requestDisabled
}: PlaygroundEndpointContentLayoutProps): ReactElement<any> {
    const isMobile = useIsMobile();

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [scrollAreaHeight, setScrollAreaHeight] = useState(0);

    useResizeObserver(scrollAreaRef, ([size]) => {
        if (size != null) {
            setScrollAreaHeight(size.contentRect.height);
        }
    });

    return (
        <div className="flex min-h-0 w-full flex-1 shrink items-stretch divide-x">
            <div
                ref={scrollAreaRef}
                className="mask-grad-top-6 w-full overflow-x-hidden overflow-y-scroll overscroll-contain"
            >
                {!isMobile ? (
                    <PlaygroundEndpointDesktopLayout
                        scrollAreaHeight={scrollAreaHeight}
                        form={form}
                        requestCard={requestCard}
                        responseCard={responseCard}
                        endpointId={endpointId}
                    />
                ) : (
                    <PlaygroundEndpointMobileLayout
                        form={form}
                        requestCard={requestCard}
                        responseCard={responseCard}
                        sendButton={
                            <PlaygroundSendRequestButton sendRequest={sendRequest} disabled={requestDisabled} />
                        }
                        endpointId={endpointId}
                    />
                )}
            </div>
        </div>
    );
}
