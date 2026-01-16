import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { FadeInTransition } from "@/components/transitions/FadeInTransition";
import { Button } from "@/components/ui/button";

export function BackArrow({ href }: { href: string }) {
    return (
        <div className="absolute top-4 left-4">
            <FadeInTransition>
                <Button asChild variant="ghost" size="icon">
                    <Link href={href} className="flex items-center gap-2" prefetch>
                        <ArrowLeftIcon className="size-4" />
                    </Link>
                </Button>
            </FadeInTransition>
        </div>
    );
}
