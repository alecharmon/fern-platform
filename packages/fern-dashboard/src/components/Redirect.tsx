"use client";

import { useEffect } from "react";

import { useRouter } from "@bprogress/next/app";

export default function Redirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.push(href);
  }, [href, router]);

  return null;
}
