import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";

import { NoiseOverlay } from "@/components/NoiseOverlay";
import { HIDE_PYLON_CLASS_NAME } from "@/components/pylon/constants";
import { PylonScript } from "@/components/pylon/PylonScript";
import { Toaster } from "@/components/ui/sonner";
import { applyOrgMappings } from "@/orgMappings";
import { AnimatedNoiseProvider } from "@/providers/AnimatedNoiseProvider";
import { PostHogProvider } from "@/providers/PosthogProvider";
import { ProgressProvider } from "@/providers/ProgressProvider";
import { ReactQueryProvider } from "@/providers/ReactQueryProvider";
import { cn } from "@/utils/utils";

import { gtPlanar } from "./fonts";
import "./globals.css";
import { getCurrentSession } from "./services/auth0/getCurrentSession";

export const metadata: Metadata = {
    title: "Fern Dashboard"
};

export default async function RootLayout({
    children
}: Readonly<{
    children: React.JSX.Element;
}>) {
    const session = await getCurrentSession();

    await applyOrgMappings();

    return (
        <html lang="en" suppressHydrationWarning className={gtPlanar.className}>
            <head>
                <link
                    rel="stylesheet"
                    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/styles/atom-one-dark.min.css"
                ></link>
            </head>
            <PylonScript />
            <body
                // id is used to remove the hidePylon class programatically
                id="body"
                className={cn("flex h-[calc(100dvh)] antialiased", HIDE_PYLON_CLASS_NAME)}
            >
                <AnimatedNoiseProvider>
                    <NoiseOverlay />

                    <Analytics />
                    <SpeedInsights />

                    <ReactQueryProvider>
                        <PostHogProvider session={session}>
                            <ProgressProvider>{children}</ProgressProvider>
                        </PostHogProvider>
                    </ReactQueryProvider>
                </AnimatedNoiseProvider>
                <Toaster
                    position="top-center"
                    richColors
                    toastOptions={{
                        classNames: {
                            icon: "!w-auto",
                            success: "!bg-green-300 !border-green-600 !text-primary",
                            content: "min-w-0"
                        }
                    }}
                    icons={{
                        success: <CheckCircleIcon className="text-primary size-6" />
                    }}
                />
            </body>
        </html>
    );
}
