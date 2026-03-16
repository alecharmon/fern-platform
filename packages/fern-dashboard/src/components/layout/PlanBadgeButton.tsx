"use client";

import Link from "next/link";

import { PopoverClose } from "@/components/ui/popover";

interface PlanBadgeButtonProps {
    planName: string;
    href: string;
}

export function PlanBadgeButton({ planName, href }: PlanBadgeButtonProps) {
    return (
        <PopoverClose asChild>
            <Link
                href={href}
                className="w-fit rounded-md border border-gray-500 bg-gray-300 px-1.5 py-0.5 text-xs text-gray-1000"
            >
                {planName} Plan
            </Link>
        </PopoverClose>
    );
}
