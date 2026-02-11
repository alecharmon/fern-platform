import Link from "next/link";

import { GithubLoginButton, GoogleLoginButton, PostmanLoginButton } from "@/components/auth/LoginButton";
import { CITestLoginForm } from "@/components/login-page/CITestLoginForm";
import { EmailLoginForm } from "@/components/login-page/EmailLoginForm";

type AuthPageCardSearchParams = {
    FERN_CI_AUTOMATED_TESTING?: string;
    redirect_on_login?: string;
};

interface AuthPageCardProps {
    headerText: string;
    buttonLabelPrefix: string;
    emailSubmitLabel?: string;
    belowFormText: string;
    belowFormLinkText: string;
    belowFormLinkHref: string;
    searchParams?: Promise<AuthPageCardSearchParams> | AuthPageCardSearchParams;
}

export async function AuthPageCard({
    headerText,
    buttonLabelPrefix,
    emailSubmitLabel,
    belowFormText,
    belowFormLinkText,
    belowFormLinkHref,
    searchParams
}: AuthPageCardProps) {
    const resolvedSearchParams: AuthPageCardSearchParams = searchParams ? await searchParams : {};
    const { FERN_CI_AUTOMATED_TESTING, redirect_on_login } = resolvedSearchParams;
    const shouldShowCITestLogin =
        !!process.env.FERN_CI_AUTOMATED_TESTING && FERN_CI_AUTOMATED_TESTING === process.env.FERN_CI_AUTOMATED_TESTING;

    return (
        <>
            <div className="px-4 flex w-full max-w-[400px] flex-col items-stretch md:mx-auto">
                <div className="mb-8 text-center text-xl font-bold">{headerText}</div>
                {shouldShowCITestLogin && <CITestLoginForm redirectOnLogin={redirect_on_login} />}
                <div className="flex flex-col gap-2">
                    <GoogleLoginButton returnTo={redirect_on_login} labelPrefix={buttonLabelPrefix} />
                    <GithubLoginButton returnTo={redirect_on_login} labelPrefix={buttonLabelPrefix} />
                    <PostmanLoginButton returnTo={redirect_on_login} labelPrefix={buttonLabelPrefix} />
                </div>
                <div className="flex items-center gap-3 my-6">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm text-gray-900">or</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <EmailLoginForm redirectOnLogin={redirect_on_login} submitLabel={emailSubmitLabel} />
                <div className="mt-4 text-center text-sm text-gray-900">
                    {belowFormText}{" "}
                    <Link href={belowFormLinkHref} className="fern-link" prefetch>
                        {belowFormLinkText}
                    </Link>
                </div>
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
