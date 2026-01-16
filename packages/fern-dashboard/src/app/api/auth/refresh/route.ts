import { NextResponse } from "next/server";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisGet } from "@/app/services/redis/redis";

export async function GET() {
    try {
        const session = await getCurrentSession();

        if (!session) {
            return NextResponse.json({ success: false });
        }

        // Check if user's session has been marked for invalidation (permissions changed)
        const isInvalidated = await redisGet(RedisCacheKey.userSessionInvalidated(session.user.sub));
        if (isInvalidated) {
            console.log(`[auth/refresh] User ${session.user.sub} session invalidated - permissions changed`);
            return NextResponse.json({ success: false });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[auth/refresh] Token refresh failed:", error);
        return NextResponse.json({ success: false });
    }
}
