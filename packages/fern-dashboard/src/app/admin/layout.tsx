import { isSuperUser } from "@fern-api/user-permissions";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
    title: "Fern Admin"
};

export default async function AdminLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await getCurrentSession();
    if (!session) {
        redirect("/su/admin/organizations");
    }
    if (!isSuperUser(session.permissions)) {
        redirect("/");
    }

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <div className="flex min-h-screen w-full flex-col bg-background">
                <header className="border-border flex items-center justify-between border-b px-6 py-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-semibold">Fern Admin</h1>
                    </div>
                    <div className="text-muted-foreground text-sm">{session.user.email}</div>
                </header>
                <AdminNav />
                <main className="flex-1 px-6 py-6">{children}</main>
            </div>
        </ThemeProvider>
    );
}
