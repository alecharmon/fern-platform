"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/utils/utils";

const NAV_ITEMS = [
    { href: "/admin/organizations", label: "Organizations" },
    { href: "/admin/sites", label: "Sites" },
    { href: "/admin/ai-jobs", label: "AI Jobs" }
];

export function AdminNav() {
    const pathname = usePathname();

    return (
        <nav className="border-border flex gap-4 border-b px-6">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "text-muted-foreground hover:border-border -mb-px border-b border-transparent pb-2.5 pt-3 text-sm font-semibold leading-6",
                            isActive &&
                                "text-(color:--primary) before:bg-(color:--primary) relative before:absolute before:inset-x-0 before:-bottom-px before:h-[2px]"
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
