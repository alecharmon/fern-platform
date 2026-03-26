import { isSuperUser } from "@fern-api/user-permissions";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentSession } from "@/services/auth0/getCurrentSession";
import { createIsFernOrgMemberChecker, FERN_ORG_NAME, getOrgIdFromName } from "@/services/auth0/management";

import { InternalAuthProvider } from "./_components/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
    title: "Fern Admin",
    description: "Internal ops tools for Fern"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
    const session = await getCurrentSession();

    if (session == null) {
        redirect("/auth/login?redirect_on_login=" + encodeURIComponent("/"));
    }

    const permissions: string[] = session.permissions ?? [];

    if (!isSuperUser(permissions)) {
        const isFernOrgMember = await createIsFernOrgMemberChecker();
        if (isFernOrgMember(session.user.sub)) {
            const fernOrgId = await getOrgIdFromName(FERN_ORG_NAME);
            const searchParams = new URLSearchParams({
                redirect_on_login: "/",
                organization: fernOrgId,
                scope: "openid profile email offline_access"
            });
            if (process.env.NEXT_PUBLIC_VENUS_AUDIENCE) {
                searchParams.set("audience", process.env.NEXT_PUBLIC_VENUS_AUDIENCE);
            }
            redirect(`/auth/login?${searchParams.toString()}`);
        }

        redirect("/auth/login");
    }

    return (
        <html lang="en">
            <body className="min-h-screen antialiased">
                <InternalAuthProvider email={session.user.email}>{children}</InternalAuthProvider>
            </body>
        </html>
    );
}
