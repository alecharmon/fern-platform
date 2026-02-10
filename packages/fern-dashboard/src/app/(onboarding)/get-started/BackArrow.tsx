"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { FadeInTransition } from "@/components/transitions/FadeInTransition";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function BackArrow({ href }: { href: string }) {
    const isMobile = useIsMobile();
    return (
        <div className="absolute top-4 left-4">
            <FadeInTransition>
                <Button asChild variant={isMobile ? "outline" : "ghost"} size="icon">
                    <Link href={href} className="flex items-center gap-2" prefetch>
                        <ArrowLeftIcon className="size-4" />
                    </Link>
                </Button>
            </FadeInTransition>
        </div>
    );
}
