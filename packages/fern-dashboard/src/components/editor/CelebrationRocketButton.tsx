"use client";

import { RocketIcon } from "lucide-react";
import { Button } from "../ui/button";

export interface CelebrationRocketButtonProps {
    onClick: () => void;
    isVisible: boolean;
}

export function CelebrationRocketButton({ onClick, isVisible }: CelebrationRocketButtonProps) {
    if (!isVisible) {
        return null;
    }

    return (
        <Button
            variant="ghost"
            size="iconSm"
            onClick={onClick}
            className="relative overflow-hidden px-2 before:pointer-events-none before:absolute before:inset-0 before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:bg-[length:200%_100%] before:content-['']"
            aria-label="View commit celebration"
        >
            <RocketIcon className="size-4 text-primary" />
        </Button>
    );
}
