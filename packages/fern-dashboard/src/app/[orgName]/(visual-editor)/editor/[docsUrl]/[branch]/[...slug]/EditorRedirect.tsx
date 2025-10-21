"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Client-side component that forces a redirect */
export function EditorRedirect({ redirectUrl }: { redirectUrl: string }) {
    const router = useRouter();

    useEffect(() => {
        // Use replace to avoid adding to history
        router.replace(redirectUrl);
    }, [redirectUrl, router]);

    return null;
}
