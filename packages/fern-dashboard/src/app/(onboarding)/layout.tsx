"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { EnableNoiseAnimation } from "@/components/EnableNoiseAnimation";
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
    const centerCard = !pathname.includes("login");
    // Hide card background for publishing and complete pages
    const hideCard = pathname.includes("/publishing") || pathname.includes("/complete");

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <EnableNoiseAnimation />
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
