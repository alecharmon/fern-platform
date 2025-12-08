import { redirect } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { EnableNoiseAnimation } from "@/components/EnableNoiseAnimation";
import { EmailLoginForm } from "@/components/login-page/EmailLoginForm";
import { LoginImage } from "@/components/login-page/LoginImage";
import { AdobeLogo } from "@/components/login-page/logos/AdobeLogo";
import { Auth0Logo } from "@/components/login-page/logos/Auth0Logo";
import { BloombergLogo } from "@/components/login-page/logos/BloombergLogo";
import { ElevenLabsLogo } from "@/components/login-page/logos/ElevenLabsLogo";
import { SquareLogo } from "@/components/login-page/logos/SquareLogo";
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

export default async function EmailLoginPage({
    searchParams
}: {
    searchParams: Record<string, string | string[] | undefined>;
}) {
    const session = await getCurrentSession();
    if (session != null) {
        redirect("/");
    }

    const redirectOnLogin =
        typeof searchParams.redirect_on_login === "string" ? searchParams.redirect_on_login : undefined;

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <EnableNoiseAnimation />
            <div className="relative flex flex-1">
                <div className="md:border-border bg-background relative flex flex-1 items-center justify-center px-4 md:ml-2 md:mt-2 md:w-[40%] md:min-w-[350px] md:flex-initial md:rounded-t-2xl md:border-x md:border-t md:shadow-md">
                    <div className="mx-4 flex w-full max-w-[400px] flex-1 flex-col items-stretch gap-6 md:mx-auto">
                        <div className="text-center text-xl font-bold">Sign in with your work email</div>
                        <EmailLoginForm redirectOnLogin={redirectOnLogin} />
                        <div className="text-center text-xs text-gray-900">
                            We use your email to route you to your organization&apos;s single sign-on.
                        </div>
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
                    <ThemeToggle className="hidden md:flex" />
                    <Button asChild variant="outline">
                        <a href="https://buildwithfern.com/learn" target="_blank" rel="noopener">
                            Documentation
                        </a>
                    </Button>
                </div>
            </div>
        </ThemeProvider>
    );
}
