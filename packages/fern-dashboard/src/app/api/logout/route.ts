import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisDel } from "@/app/services/redis/redis";

/**
 * Custom logout route that clears the Redis session invalidation flag
 * before redirecting to Auth0's logout endpoint.
 */
export async function GET() {
    // Clear the Redis session invalidation flag so user won't be logged out again
    // after re-authenticating with fresh permissions
    try {
        const session = await getCurrentSession();
        if (session) {
            await redisDel(RedisCacheKey.userSessionInvalidated(session.user.sub));
            console.log(`[logout] Cleared session invalidation flag for user ${session.user.sub}`);
        }
    } catch (error) {
        // Don't block logout if Redis cleanup fails
        console.error("[logout] Failed to clear session invalidation flag:", error);
    }

    // Redirect to Auth0 logout
    redirect("/auth/logout");
}
