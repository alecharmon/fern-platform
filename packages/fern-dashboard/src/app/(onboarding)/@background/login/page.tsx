import { LoginImage } from "@/components/login-page/LoginImage";
import { AdobeLogo } from "@/components/login-page/logos/AdobeLogo";
import { Auth0Logo } from "@/components/login-page/logos/Auth0Logo";
import { ElevenLabsLogo } from "@/components/login-page/logos/ElevenLabsLogo";
import { SquareLogo } from "@/components/login-page/logos/SquareLogo";
import { TwilioLogo } from "@/components/login-page/logos/TwilioLogo";
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { FadeInTransition } from "@/components/transitions/FadeInTransition";
import { SlideRightTransition } from "@/components/transitions/SlideRightTransition";
import { SlideUpTransition } from "@/components/transitions/SlideUpTransition";

/**
 * Background content slot for login page
 */
export default function AuthBackgroundSlot() {
    return (
        <div className="mt-16 flex min-h-0 flex-1 flex-col overflow-hidden">
            <SlideRightTransition>
                <div className="z-3 relative mx-16 flex flex-col">
                    <ThemedFernLogo className="mb-8 mt-4 w-28" />
                    <div className="text-3xl font-bold tracking-tight">
                        <div className="text-gray-1100">Instantly offer</div>
                        <div>
                            SDKs <span className="text-gray-1100">and</span> API Docs
                        </div>
                    </div>
                </div>
            </SlideRightTransition>
            <div className="relative mb-2 flex flex-1">
                <FadeInTransition duration={0.6}>
                    <LoginImage />
                </FadeInTransition>
            </div>
            <div className="absolute bottom-0 left-0 right-0">
                <SlideUpTransition>
                    <div className="flex flex-col gap-3 p-16">
                        <div className="text-gray-1000 text-left text-sm">
                            Giving API superpowers to world-class companies
                        </div>
                        <div className="flex flex-wrap items-center gap-y-4 sm:gap-x-3 md:gap-x-6 lg:gap-x-8 ">
                            <SquareLogo />
                            <TwilioLogo />
                            <AdobeLogo />
                            <ElevenLabsLogo />
                            <Auth0Logo />
                        </div>
                    </div>
                </SlideUpTransition>
            </div>
        </div>
    );
}
