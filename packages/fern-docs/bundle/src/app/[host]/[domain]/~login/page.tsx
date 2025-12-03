import "server-only";

import PasswordLoginForm from "@/components/PasswordLoginForm";

export const dynamic = "force-dynamic";

interface LoginPageProps {
    searchParams: Promise<{ returnTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const { returnTo } = await searchParams;

    return (
        <div className="flex min-h-[calc(100svh-var(--header-height)-6rem)] w-screen flex-col items-center justify-center gap-6 px-4">
            <div className="flex flex-col text-center gap-2">
                <h1 className="text-2xl font-semibold text-(color:--grayscale-a12)">Sign in</h1>
                <p className="text-(color:--grayscale-a9)">This site is password protected.</p>
            </div>

            <PasswordLoginForm returnTo={returnTo ?? "/"} />
        </div>
    );
}
