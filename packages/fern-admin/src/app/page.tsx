"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useInternalAuth } from "./_components/AuthContext";
import { INTERNAL_TOOLS } from "./_lib/tools";

export default function HomePage() {
    const searchParams = useSearchParams();
    const { email } = useInternalAuth();
    const domain = searchParams.get("domain");
    const sourcePath = searchParams.get("path");

    const queryString = searchParams.toString();
    const linkSuffix = queryString ? `?${queryString}` : "";

    return (
        <div className="flex h-full flex-col items-center p-8">
            <div className="w-full max-w-2xl space-y-8">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">Internal ops tools</h1>
                        <p className="text-gray-1000 text-sm">
                            Signed in as <span className="text-gray-1200 font-medium">{email}</span>
                        </p>
                        {domain && (
                            <p className="text-gray-900 text-xs">
                                Redirected from: {domain}
                                {sourcePath}
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid gap-3">
                    {INTERNAL_TOOLS.map((tool) => (
                        <Link
                            key={tool.link}
                            href={`${tool.link}${linkSuffix}`}
                            className="border-border hover:border-gray-700 group flex items-center justify-between rounded-xl border bg-gray-100 p-5 transition-colors"
                        >
                            <div className="space-y-0.5">
                                <h2 className="text-sm font-medium">{tool.title}</h2>
                                <p className="text-gray-1000 text-xs">{tool.description}</p>
                            </div>
                            <ArrowRight className="text-gray-800 group-hover:text-gray-1100 size-4 transition-colors" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
