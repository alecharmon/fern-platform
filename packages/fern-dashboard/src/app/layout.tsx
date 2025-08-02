import type { Metadata } from "next";

import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { PylonScript } from "@/components/pylon/PylonScript";
import { HIDE_PYLON_CLASS_NAME } from "@/components/pylon/constants";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/providers/PosthogProvider";
import { ProgressProvider } from "@/providers/ProgressProvider";
import { ReactQueryProvider } from "@/providers/ReactQueryProvider";
import { cn } from "@/utils/utils";

import { gtPlanar } from "./fonts";
import "./globals.css";
import { getCurrentSession } from "./services/auth0/getCurrentSession";

export const metadata: Metadata = {
  title: "Fern Dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.JSX.Element;
}>) {
  const session = await getCurrentSession();

  return (
    <html lang="en" suppressHydrationWarning className={gtPlanar.className}>
      <PylonScript />
      <body
        // id is used to remove the hidePylon class programatically
        id="body"
        className={cn(
          "noise flex h-[calc(100dvh)] antialiased",
          HIDE_PYLON_CLASS_NAME
        )}
      >
        <Analytics />
        <SpeedInsights />

        <ReactQueryProvider>
          <PostHogProvider session={session}>
            <ProgressProvider>{children}</ProgressProvider>
          </PostHogProvider>
        </ReactQueryProvider>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            classNames: {
              icon: "!w-auto",
              success: "!bg-green-300 !border-green-600 !text-primary",
              content: "min-w-0",
            },
          }}
          icons={{
            success: <CheckCircleIcon className="text-primary size-6" />,
          }}
        />
      </body>
    </html>
  );
}
