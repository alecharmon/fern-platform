import { BookOpen, HelpCircle } from "lucide-react";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { FadeInTransition } from "@/components/transitions/FadeInTransition";
import { Button } from "@/components/ui/button";

/**
 * Overlay content slot - shared as default across all onboarding pages
 */
export default async function DefaultOnboardingOverlaySlot() {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    return (
        <>
            {/* Top left content */}
            <FadeInTransition>
                <ThemedFernLogo className="absolute top-2 left-6 mb-8 mt-4 w-14" />
            </FadeInTransition>

            {/* Top right content */}
            <FadeInTransition>
                <ThemeToggle className="absolute top-4 right-4" />
            </FadeInTransition>

            {/* Bottom left content */}
            <div className="hidden md:block absolute left-2 bottom-4 max-w-[280px]">
                <FadeInTransition>
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1">
                            <Button asChild variant="ghost" className="w-fit">
                                <a href="https://buildwithfern.com/learn" target="_blank" rel="noopener">
                                    <HelpCircle />
                                    Support
                                </a>
                            </Button>
                            <Button asChild variant="ghost" className="w-fit">
                                <a href="https://buildwithfern.com/learn" target="_blank" rel="noopener">
                                    <BookOpen />
                                    Documentation
                                </a>
                            </Button>
                        </div>

                        <div className="flex flex-col gap-3">
                            <p className="px-3 text-xs text-muted-foreground">
                                Signed in as <b>{session.user.email}</b>
                            </p>
                            <div className="flex items-center justify-between w-[275px]">
                                <LogoutButton className="ml-3 w-fit" />
                                <ThemeToggle className="ml-2" />
                            </div>
                        </div>
                    </div>
                </FadeInTransition>
            </div>
        </>
    );
}
