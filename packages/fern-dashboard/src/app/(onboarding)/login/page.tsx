import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { GithubLoginButton, GoogleLoginButton } from "@/components/auth/LoginButton";
import { CITestLoginForm } from "@/components/login-page/CITestLoginForm";
import { EmailLoginForm } from "@/components/login-page/EmailLoginForm";

interface LoginPageProps {
    searchParams: Promise<{ FERN_CI_AUTOMATED_TESTING?: string }>;
}

export default async function LoginCardSlot({ searchParams }: LoginPageProps) {
    const session = await getCurrentSession();

    if (session != null) {
        redirect("/");
    }

    const { FERN_CI_AUTOMATED_TESTING } = await searchParams;
    const showCITestLogin =
        !!process.env.FERN_CI_AUTOMATED_TESTING && FERN_CI_AUTOMATED_TESTING === process.env.FERN_CI_AUTOMATED_TESTING;

    return (
        <>
            <div className="mx-4 flex w-full max-w-[400px] flex-1 flex-col items-stretch md:mx-auto">
                <div className="mb-8 text-center text-xl font-bold">Log in to Fern</div>
                {showCITestLogin && <CITestLoginForm />}
                <div className="flex flex-col gap-2">
                    <GoogleLoginButton />
                    <GithubLoginButton />
                </div>
                <div className="flex items-center gap-3 my-6">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm text-gray-900">or</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <EmailLoginForm />
            </div>
            <div className="absolute bottom-16 left-0 right-0 mx-auto px-4 text-center text-xs text-gray-900 md:max-w-[400px]">
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
                <a href="https://buildwithfern.com/privacy-policy" target="_blank" className="underline" rel="noopener">
                    Privacy Policy
                </a>
                , and to receive periodic emails with updates.
            </div>
        </>
    );
}
