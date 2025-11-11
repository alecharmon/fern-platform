"use client";

import { MaybeFernLink } from "@fern-docs/components/FernLink";
import { Separator } from "@fern-docs/components/Separator";
import { t } from "@fern-docs/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

export function BottomNavigationClient({
    prev,
    next,
    lang,
    footerNavStyle = "default"
}: {
    prev?: {
        title?: React.ReactNode;
        excerpt?: React.ReactNode;
        href?: string;
        shallow?: boolean;
        onClick?: () => void;
    };
    next?: {
        title?: React.ReactNode;
        excerpt?: React.ReactNode;
        href?: string;
        shallow?: boolean;
        onClick?: () => void;
    };
    lang: string;
    footerNavStyle?: "default" | "minimal";
}) {
    const router = useRouter();
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.key === "ArrowLeft" && event.altKey) || (event.key === "ArrowLeft" && event.metaKey)) {
                prev?.onClick?.();
                if (prev?.href) {
                    router.push(prev.href, { scroll: true });
                }
            } else if ((event.key === "ArrowRight" && event.altKey) || (event.key === "ArrowRight" && event.metaKey)) {
                next?.onClick?.();
                if (next?.href) {
                    router.push(next.href, { scroll: true });
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [next, prev, router]);

    if (prev == null && next == null) {
        return <Separator />;
    }

    return (
        <nav
            aria-label={t(lang).navigation.upNext}
            className={`fern-footer-nav${footerNavStyle === "minimal" ? " fern-footer-nav--simple" : ""}`}
        >
            {footerNavStyle === "minimal" && !prev && next && (
                <span className="fern-footer-prev p-2 invisible pointer-events-none" aria-hidden="true" />
            )}
            {prev && (
                <MaybeFernLink
                    href={prev.href}
                    className="fern-footer-prev"
                    shallow={prev.shallow}
                    onClick={prev.onClick}
                >
                    {footerNavStyle === "default" ? (
                        <>
                            <ChevronLeft className="size-icon text-(color:--grayscale-a9)" />
                            <span className="text-(color:--grayscale-a11) hidden text-sm font-medium sm:block">
                                {t(lang).navigation.previous}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="relative inline-flex items-center gap-1 -ml-1">
                                <ChevronLeft className="size-icon" />
                                <span className="hidden text-sm font-medium sm:block">
                                    {t(lang).navigation.previous}
                                </span>
                            </span>
                            {prev.title && (
                                <div className="relative min-w-0 shrink pr-4 text-left w-full">
                                    <h4 className="text-(color:--grayscale-a12) truncate text-base font-bold [&_*]:truncate">
                                        {prev.title}
                                    </h4>
                                </div>
                            )}
                        </>
                    )}
                </MaybeFernLink>
            )}
            {next && (
                <MaybeFernLink
                    href={next.href}
                    className={`fern-footer-next${footerNavStyle === "default" ? " fern-background-image" : ""}`}
                    shallow={next.shallow}
                    onClick={next.onClick}
                >
                    {next.title ? (
                        footerNavStyle === "minimal" ? (
                            <>
                                <span className="relative inline-flex items-center gap-1 -mr-1">
                                    <span className="hidden text-sm font-medium sm:block">
                                        {t(lang).navigation.next}
                                    </span>
                                    <ChevronRight className="size-icon" />
                                </span>
                                <div className="relative min-w-0 shrink pl-4 text-right w-full">
                                    <h4 className="text-(color:--grayscale-a12) truncate text-base font-bold [&_*]:truncate">
                                        {next.title}
                                    </h4>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="relative min-w-0 shrink pl-4 text-right">
                                    <h4 className="text-(color:--grayscale-a12) truncate text-base font-bold [&_*]:truncate">
                                        {next.title}
                                    </h4>
                                    {next.excerpt && (
                                        <div className="text-(color:--grayscale-a11) truncate text-sm [&_*]:truncate">
                                            {next.excerpt}
                                        </div>
                                    )}
                                </div>
                                <Separator
                                    orientation="vertical"
                                    className="bg-(color:--grayscale-a5) relative hidden h-8 w-px sm:block"
                                />
                                <span className="relative inline-flex items-center gap-1">
                                    <span className="text-(color:--grayscale-a11) hidden text-sm font-medium sm:block">
                                        {t(lang).navigation.next}
                                    </span>
                                    <ChevronRight className="size-icon text-(color:--grayscale-a9)" />
                                </span>
                            </>
                        )
                    ) : footerNavStyle === "default" ? (
                        <span className="relative inline-flex items-center gap-1">
                            <span className="text-(color:--grayscale-a11) hidden text-sm font-medium sm:block">
                                {t(lang).navigation.next}
                            </span>
                            <ChevronRight className="size-icon text-(color:--grayscale-a9)" />
                        </span>
                    ) : (
                        <span className="relative inline-flex items-center gap-1 -mr-1">
                            <span className="hidden text-sm font-medium sm:block">{t(lang).navigation.next}</span>
                            <ChevronRight className="size-icon" />
                        </span>
                    )}
                </MaybeFernLink>
            )}
        </nav>
    );
}
