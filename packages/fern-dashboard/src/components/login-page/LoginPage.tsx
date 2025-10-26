import { BookOpen } from "lucide-react";

import { GithubLoginButton, GoogleLoginButton } from "../auth/LoginButton";
import { ThemedFernLogo } from "../theme/ThemedFernLogo";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Button } from "../ui/button";
import { LoginImage } from "./LoginImage";
import { AdobeLogo } from "./logos/AdobeLogo";
import { Auth0Logo } from "./logos/Auth0Logo";
import { BloombergLogo } from "./logos/BloombergLogo";
import { ElevenLabsLogo } from "./logos/ElevenLabsLogo";
import { SquareLogo } from "./logos/SquareLogo";

export const LoginPage = () => {
    return (
        <div className="relative flex flex-1">
            <div className="md:border-border bg-background relative flex flex-1 items-center justify-center px-4 md:ml-2 md:mt-2 md:w-[40%] md:min-w-[350px] md:flex-initial md:rounded-t-2xl md:border-x md:border-t md:shadow-md">
                <div className="mx-4 flex w-full max-w-[400px] flex-1 flex-col items-stretch md:mx-auto">
                    <div className="mb-2 text-center text-xl font-bold">Welcome to Fern</div>
                    <div className="mb-8 text-center text-sm text-gray-900">Sign in to your account</div>
                    <div className="flex flex-col gap-2">
                        <GithubLoginButton />
                        <GoogleLoginButton />
                    </div>
                </div>
                <div className="absolute bottom-16 left-0 right-0 mx-[15%] mx-auto px-4 text-center text-xs text-gray-900 md:max-w-[400px]">
                    By continuing, you agree to Fern&apos;s{" "}
                    <a
                        href="https://buildwithfern.com/terms-of-service"
                        target="_blank"
                        className="underline"
                        rel="noopener"
                    >
                        Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                        href="https://buildwithfern.com/privacy-policy"
                        target="_blank"
                        className="underline"
                        rel="noopener"
                    >
                        Privacy Policy
                    </a>
                    , and to receive periodic emails with updates.
                </div>
            </div>
            <div className="relative hidden flex-1 flex-col md:flex">
                <div className="mt-16 flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="z-3 relative mx-16 flex flex-col">
                        <ThemedFernLogo className="mb-8 mt-4 w-28" />
                        <div className="text-3xl font-bold tracking-tight">
                            <div className="text-gray-1100">Instantly offer</div>
                            <div>
                                SDKs <span className="text-gray-1100">and</span> API Docs
                            </div>
                        </div>
                    </div>
                    <div className="relative mb-2 flex flex-1">
                        <LoginImage />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-4 p-16">
                        <div className="text-gray-1000 text-left text-sm">
                            Giving API superpowers to world-class companies
                        </div>
                        <div className="flex flex-wrap items-center sm:gap-3 md:gap-6 lg:gap-8">
                            <SquareLogo />
                            <BloombergLogo />
                            <AdobeLogo />
                            <ElevenLabsLogo />
                            <Auth0Logo />
                        </div>
                    </div>
                </div>
            </div>
            <div className="absolute right-4 top-4 flex gap-2">
                <ThemeToggle />
                <Button asChild variant="outline">
                    <a href="https://buildwithfern.com/learn" target="_blank" rel="noopener">
                        <BookOpen />
                        Documentation
                    </a>
                </Button>
            </div>
        </div>
    );
};
