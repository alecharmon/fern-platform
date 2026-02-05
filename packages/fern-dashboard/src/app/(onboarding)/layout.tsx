"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { SplitLayout } from "@/components/layout/SplitLayout";
import { OnboardingProvider } from "@/providers/OnboardingProvider";

/**
 * Shared layout for authentication pages using parallel routes.
 *
 * Parallel route slots:
 * - children: Login or get-started content
 * - @background: Shared background content (logos, image, tagline)
 * - @overlay: Shared overlay content (Fern logo, theme toggle, docs button)
 *
 * This layout persists across route transitions, allowing smooth animations
 * between login and get-started pages.
 */
export default function AuthLayout({
    children,
    background,
    overlay
}: {
    children: ReactNode;
    background: ReactNode;
    overlay: ReactNode;
}) {
    const pathname = usePathname();
    const centerCard = !pathname.includes("login") && !pathname.includes("sign-up");
    // Hide card background for complete page only (publishing page now shows the card UI)
    const hideCard = pathname.includes("/complete");

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <OnboardingProvider>
                <SplitLayout
                    cardContent={children}
                    backgroundContent={background}
                    overlay={overlay}
                    centerCard={centerCard}
                    hideCard={hideCard}
                    animationDuration={500}
                />
            </OnboardingProvider>
        </ThemeProvider>
    );
}
