import "server-only";

import { redirect } from "next/navigation";

import { getCurrentPath } from "@/utils/headers";

/**
 * Redirects the user to the login page while storing the attempted route.
 * After successful authentication, the user will be redirected back to the attempted route.
 * If the current path cannot be determined, redirects to login without storing a redirect target.
 */
export async function redirectToLogin(): Promise<never> {
    const currentPath = await getCurrentPath();
    if (currentPath && currentPath !== "/") {
        redirect(`/login?redirect_on_login=${encodeURIComponent(currentPath)}`);
    }
    redirect("/login");
}
