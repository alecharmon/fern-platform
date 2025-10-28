"use client";

import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/utils";
import { Button } from "./button";

interface StepsProps {
    children: ReactNode;
    className?: string;
}

export function Steps({ children, className }: StepsProps) {
    return <div className={cn("relative space-y-8 border-l border-border pl-6", className)}>{children}</div>;
}

interface StepProps {
    number: number;
    title: string;
    children: ReactNode;
    className?: string;
    completed?: boolean;
}

export function Step({ number, title, children, className, completed = false }: StepProps) {
    return (
        <div className={cn("relative", className)}>
            <Button
                variant="outline"
                size="iconSm"
                className={cn(
                    "pointer-events-none absolute -left-[38px] flex size-7 items-center justify-center text-sm font-semibold",
                    completed && "bg-primary text-primary-foreground border-primary"
                )}
            >
                {completed ? <CheckIcon className="size-4" /> : number}
            </Button>
            <h3 className="mb-3 text-base font-semibold">{title}</h3>
            <div>{children}</div>
        </div>
    );
}
