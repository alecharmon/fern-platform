import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Custom logout route that clears the CI test session cookie
 * before redirecting to Auth0's logout endpoint.
 */
export async function GET() {
    const cookieStore = await cookies();

    // Clear the CI test session cookie if it exists
    if (cookieStore.has("ci_test_session")) {
        cookieStore.delete("ci_test_session");
    }

    // Redirect to Auth0 logout
    redirect("/auth/logout");
}
