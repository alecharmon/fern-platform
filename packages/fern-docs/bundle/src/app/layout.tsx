import * as Sentry from "@sentry/nextjs";
import type { Metadata, Viewport } from "next/types";
import { experimental_taintUniqueValue } from "react";

import "./globals.css";

const secrets = [
    "ALGOLIA_API_KEY",
    "ALGOLIA_SEARCH_API_KEY",
    "ALGOLIA_WRITE_API_KEY",
    "ANTHROPIC_API_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "COHERE_API_KEY",
    "EDGE_CONFIG",
    "FERN_TOKEN",
    "JWT_SECRET_KEY",
    "KV_REST_API_READ_ONLY_TOKEN",
    "KV_REST_API_TOKEN",
    "OPENAI_API_KEY",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "QSTASH_TOKEN",
    "TURBOPUFFER_API_KEY",
    "WORKOS_API_KEY",
    "HIGHLIGHT_PROJECT_ID_FERN_APP",
    "VERCEL_AUTOMATION_BYPASS_SECRET"
];

export default function Layout({ children }: { children: React.ReactNode }) {
    for (const secret of secrets) {
        const secretValue = process.env[secret];
        if (secretValue != null) {
            experimental_taintUniqueValue(`Do not pass ${secret} to the client.`, process.env, secretValue);
        }
    }

    return children;
}

export const viewport: Viewport = {
    width: "device-width",
    height: "device-height",
    initialScale: 1,
    maximumScale: 1,
    minimumScale: 1,
    userScalable: true
};

export function generateMetadata(): Metadata {
    return {
        generator: "https://buildwithfern.com",
        other: {
            ...Sentry.getTraceData()
        }
    };
}
