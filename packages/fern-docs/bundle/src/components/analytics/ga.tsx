import { useFernUser } from "@fern-docs/components/state/fern-user";
import { useServerInsertedHTML } from "next/navigation";
import Script from "next/script";
import React, { type ReactNode, useEffect, useRef } from "react";

import { useSafeListenTrackEvents } from "./use-track";

declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
    interface Window {
        [key: string]: any;
    }
}

type GAParams = {
    gaId: string;
    dataLayerName?: string;
    debugMode?: boolean;
    nonce?: string;
};

export default function GoogleAnalytics(props: GAParams): ReactNode {
    const { gaId, debugMode, dataLayerName = "dataLayer", nonce } = props;
    const fernUser = useFernUser();
    const userIdSetRef = useRef(false);

    useEffect(() => {
        // performance.mark is being used as a feature use signal. While it is traditionally used for performance
        // benchmarking it is low overhead and thus considered safe to use in production and it is a widely available
        // existing API.
        // The performance measurement will be handled by Chrome Aurora

        performance.mark("mark_feature_usage", {
            detail: {
                feature: "fern-analytics-ga"
            }
        });
    }, []);

    // Set user_id for Google Analytics when user is logged in with a sub claim
    useEffect(() => {
        if (fernUser?.sub && !userIdSetRef.current) {
            const gtag = window.gtag;
            if (typeof gtag === "function") {
                gtag("set", { user_id: fernUser.sub });
                userIdSetRef.current = true;
            }
        }
    }, [fernUser?.sub]);

    useSafeListenTrackEvents(({ event, properties }) => {
        sendGAEvent(dataLayerName, { event, properties });
    });

    const inserted = React.useRef(false);
    useServerInsertedHTML(() => {
        if (inserted.current) {
            return null;
        }
        inserted.current = true;

        return (
            <script
                key="ga"
                id="_fern-ga-init"
                defer
                dangerouslySetInnerHTML={{
                    __html: `
        window['${dataLayerName}'] = window['${dataLayerName}'] || [];
        function gtag(){window['${dataLayerName}'].push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId}' ${debugMode ? ",{ 'debug_mode': true }" : ""});`
                }}
                nonce={nonce}
            />
        );
    });

    return <Script id="_fern-ga" defer src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} nonce={nonce} />;
}

function sendGAEvent(dataLayer: string, ...args: unknown[]): void {
    if (window[dataLayer]) {
        window[dataLayer].push(...args);
    } else {
        console.warn(`GA dataLayer ${dataLayer} does not exist`);
    }
}
