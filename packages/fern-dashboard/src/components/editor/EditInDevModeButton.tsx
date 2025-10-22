"use client";

import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

import { useDevMode } from "@/providers/DevModeProvider";

import { Button } from "../ui/button";

export const EditInDevModeButton = ({
    variant = "outline",
    size = "sm",
    onClick,
    ...props
}: ComponentProps<typeof Button>) => {
    const { setPanelOpen } = useDevMode();

    const handleToggleDevMode = (e: React.MouseEvent<HTMLButtonElement>) => {
        setPanelOpen(true);
        onClick?.(e);
    };

    return (
        <Button onClick={handleToggleDevMode} variant={variant} size={size} {...props}>
            Edit in dev mode <ArrowRight className="size-4" />
        </Button>
    );
};
