"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import React, { useLayoutEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/utils";

export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme();

    /**
     * Prevent hydration mismatch by deferring theme-dependent rendering until after mount.
     * Server cannot access localStorage/user preferences, so theme is undefined during SSR,
     * but has actual value on client after hydration.
     */
    const [hasMounted, setHasMounted] = useState(false);
    const mountedTheme = hasMounted && theme ? theme : "system";

    useLayoutEffect(() => setHasMounted(true), []);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                        "w-fit justify-start px-0 text-left hover:px-2 has-[>svg]:px-0 hover:has-[>svg]:px-2 md:w-8 md:justify-center",
                        className
                    )}
                >
                    {mountedTheme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
                    {mountedTheme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
                    {mountedTheme === "system" && <Monitor className="h-[1.2rem] w-[1.2rem]" />}
                    <span className="sr-only">Toggle theme</span>
                    <span className="block md:hidden">Theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" collisionPadding={8}>
                <DropdownMenuItem
                    onClick={() => {
                        setTheme("light");
                    }}
                >
                    <Sun className="block h-[1.2rem] w-[1.2rem]" />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        setTheme("dark");
                    }}
                >
                    <Moon className="block h-[1.2rem] w-[1.2rem]" />
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        setTheme("system");
                    }}
                >
                    <Monitor className="block h-[1.2rem] w-[1.2rem]" />
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
