"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import React from "react";

const ReactQueryDevtools = dynamic(
    () => import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
    { ssr: false }
);

export declare namespace ReactQueryProvider {
    export interface Props {
        children: React.JSX.Element;
    }
}

export function ReactQueryProvider({ children }: ReactQueryProvider.Props) {
    const [client] = React.useState(new QueryClient());

    return (
        <QueryClientProvider client={client}>
            {children}
            {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
    );
}
