import "server-only";

import { Key } from "lucide-react";
import PasswordLoginForm from "@/components/PasswordLoginForm";

export const dynamic = "force-dynamic";

interface LoginPageProps {
    searchParams: Promise<{ returnTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const { returnTo } = await searchParams;

    return (
        <div
            className="flex min-h-[calc(100svh-var(--header-height))] w-screen flex-col items-center justify-center px-4"
            style={{
                background: "radial-gradient(57.52% 46.89% at 50% 53.11%, var(--accent-a3) 0%, var(--background) 100%)"
            }}
        >
            <div
                className="flex w-full max-w-[480px] flex-col gap-8 rounded-[24px] p-12"
                style={{
                    background: "var(--grayscale-1)",
                    boxShadow: "0 0 0 1px var(--grayscale-a4) inset, 0 2px 4px 0 rgba(0, 0, 0, 0.05) inset"
                }}
            >
                <div className="flex flex-col gap-8 items-center">
                    <Key size="32" />
                    <div className="flex flex-col gap-2 text-center">
                        <h1 className="text-2xl font-semibold text-(--grayscale-a12)">Password required</h1>
                        <p className="text-(--grayscale-a9)">You need a password to access this site.</p>
                    </div>
                </div>

                <PasswordLoginForm returnTo={returnTo ?? "/"} />
            </div>
        </div>
    );
}
