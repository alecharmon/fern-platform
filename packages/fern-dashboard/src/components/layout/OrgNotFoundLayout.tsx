import { ThemeProvider } from "next-themes";
import { Suspense } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { OrgSwitcher } from "@/components/auth/OrgSwitcher";
import { OrgNotFound } from "@/components/OrgNotFound";
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import { OrgNameProvider } from "../../app/[orgName]/context/OrgNameContext";

export async function OrgNotFoundLayout({ orgName }: { orgName: Auth0OrgName }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <OrgNameProvider orgName={orgName}>
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-4 p-4">
                        <div className="flex min-w-0 items-center gap-4">
                            <ThemedFernLogo className="w-16" />
                            <Suspense fallback={<div className="h-[36px]" />}>
                                <OrgSwitcher />
                            </Suspense>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <div className="hidden items-center md:flex">
                                <ThemeToggle />
                            </div>
                        </div>
                    </div>

                    <OrgNotFound />
                </div>
            </OrgNameProvider>
        </ThemeProvider>
    );
}
