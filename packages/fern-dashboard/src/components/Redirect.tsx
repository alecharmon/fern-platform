"use client";

import { useRouter } from "@bprogress/next/app";
import { useEffect } from "react";

export default function Redirect({ href }: { href: string }) {
    const router = useRouter();
    useEffect(() => {
        router.push(href);
    }, [href, router]);

    return null;
}
