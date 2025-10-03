import Image from "next/image";

import { cn } from "@/utils/utils";

export function GradientBackground({ className }: { className?: string }) {
    return (
        <Image
            src="/gradient-background.svg"
            alt="Gradient Background"
            className={cn("h-full w-full", className)}
            width={100}
            height={100}
        />
    );
}
