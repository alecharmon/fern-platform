"use client";

import { ProgressProvider as BProgressProvider } from "@bprogress/next/app";

export declare namespace ProgressProvider {
    export interface Props {
        children: React.JSX.Element;
    }
}

export function ProgressProvider({ children }: ProgressProvider.Props) {
    return (
        <BProgressProvider
            height="2px"
            color="var(--green-1100)"
            // don't show spinner in the top right
            options={{ showSpinner: false }}
            delay={200}
            startOnLoad
            disableSameURL
            memo
        >
            {children}
        </BProgressProvider>
    );
}
