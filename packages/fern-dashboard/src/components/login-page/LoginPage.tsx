import { BookOpen } from "lucide-react";

import { GithubLoginButton, GoogleLoginButton } from "../auth/LoginButton";
import { ThemedFernLogo } from "../theme/ThemedFernLogo";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Button } from "../ui/button";
import { EmailLoginForm } from "./EmailLoginForm";
import { LoginImage } from "./LoginImage";
import { AdobeLogo } from "./logos/AdobeLogo";
import { Auth0Logo } from "./logos/Auth0Logo";
import { BloombergLogo } from "./logos/BloombergLogo";
import { ElevenLabsLogo } from "./logos/ElevenLabsLogo";
import { SquareLogo } from "./logos/SquareLogo";

export const LoginPage = () => {
    return (
        <div className="relative flex flex-1">
            <svg
                className="absolute left-5 top-5 z-10 md:hidden"
                fill="none"
                height="24"
                viewBox="0 0 32 32"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="m28.5979 15.3533c-2.0648-1.7457-5.1754-2.4455-7.9323-.4076-.1269.0923-.2846-.0654-.1883-.1884.6536-.8421 1.4111-1.7495 2.0224-2.6608.6229-.9343 1.5534-1.6034 2.6261-1.9302 5.71-1.73027 3.9952-10.1663 3.9952-10.1663s-8.8207.569066-7.7325 8.17841c.1807 1.27271-.1577 2.56849-.9535 3.57979-.9766 1.2342-2.111 2.4146-2.9338 3.2682-.1731.1769-.4653.0077-.3961-.2307.796-2.68 1.3766-6.82492-1.3803-9.49722l-3.8797-3.22215-.7459.98433c-2.21862 2.92607-1.56881 7.05184 1.3611 9.26654 1.6803 1.2689 2.4416 2.6493 2.3224 4.1642-.073.9074-.4844 1.7572-1.0997 2.4301-1.1573 1.2688-2.2378 2.6299-3.0722 4.2065-.1153.2192-.4498.1346-.4383-.1154.1192-2.6032-.1307-8.4706-4.51407-10.5662l-4.906281-1.8956-.38066 1.1343c-1.234259 3.6605.784391 7.5709 4.441021 8.8129 3.17986 1.0804 4.31415 3.1297 3.54898 6.202-.0346.1114-.58828 3.276-.51138 4.6794h3.52589c.1192-2.1762 2.4032-3.6067 4.3834-2.7184.5575.2499 1.1304.6074 1.7187 1.0688 3.1529 2.484 7.7978 1.8957 10.2778-1.261l.7075-.8999-4.4602-3.2028c-3.0606-2.407-7.1441-1.3188-10.1664.742-.2537.173-.5767-.1037-.4345-.3807 3.6528-7.1671 8.4015-7.1517 10.2625-5.5599 2.257 1.9303 5.6753 1.5841 7.5901-.6805l.5499-.6498-3.2107-2.4839z"
                    fill="#51c233"
                />
            </svg>
            <div className="md:border-border bg-background relative flex flex-1 items-center justify-center px-4 md:ml-2 md:mt-2 md:w-[40%] md:min-w-[350px] md:flex-initial md:rounded-t-2xl md:border-x md:border-t md:shadow-md">
                <div className="mx-4 flex w-full max-w-[400px] flex-1 flex-col items-stretch md:mx-auto">
                    <div className="mb-8 text-center text-xl font-bold">Log in to Fern</div>
                    <div className="flex flex-col gap-2">
                        <GoogleLoginButton />
                        <GithubLoginButton />
                    </div>
                    <div className="flex items-center gap-3 my-4">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-sm text-gray-900">or</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>
                    <EmailLoginForm />
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
                <ThemeToggle className="hidden md:flex" />
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
