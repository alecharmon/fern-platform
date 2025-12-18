import { redirect } from "next/navigation";

export default async function EmailLoginPage({
    searchParams
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const redirectOnLogin = typeof params.redirect_on_login === "string" ? params.redirect_on_login : undefined;

    // Redirect to unified login page, preserving redirect_on_login if present
    if (redirectOnLogin) {
        redirect(`/login?redirect_on_login=${encodeURIComponent(redirectOnLogin)}`);
    }

    redirect("/login");
}
