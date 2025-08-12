"use client";

import { ProgressProvider } from "@bprogress/next/app";
import { TooltipProvider } from "@radix-ui/react-tooltip";

import { Toaster } from "../FernToast";
import { JotaiProvider } from "../state/jotai-provider";
import StyledJsxRegistry from "./registry";

export function Providers({
  children,
  loaderColor,
  skipProgressProvider = false,
}: {
  children: React.ReactNode;
  loaderColor?: string;
  skipProgressProvider?: boolean;
}) {
  const content = (
    <StyledJsxRegistry>
      <JotaiProvider>
        <TooltipProvider>
          <Toaster />
          {children}
        </TooltipProvider>
      </JotaiProvider>
    </StyledJsxRegistry>
  );

  if (skipProgressProvider) {
    return content;
  }

  return (
    <ProgressProvider
      height="3px"
      color={loaderColor ?? "var(--accent)"}
      options={{ showSpinner: false }}
      disableSameURL
      delay={300}
      memo
      shouldCompareComplexProps
    >
      {content}
    </ProgressProvider>
  );
}
