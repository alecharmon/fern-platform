"use client";

import { useEffect, useRef, useState } from "react";

import type { IssueCounts } from "@/app/actions/getDocsScore";
import { cn } from "@/utils/utils";

interface SeveritySummaryProps {
    issueCounts: IssueCounts | null;
    isProcessing?: boolean;
}

const SEVERITY_CONFIG = {
    critical: {
        label: "Critical",
        textClass: "text-red-700 dark:text-red-400",
        bgClass: "bg-red-50 dark:bg-red-900/20",
        borderClass: "border-red-200 dark:border-red-800",
        pulseClass: "shadow-red-200 dark:shadow-red-900/50"
    },
    high: {
        label: "High",
        textClass: "text-red-700 dark:text-red-400",
        bgClass: "bg-red-50 dark:bg-red-900/20",
        borderClass: "border-red-200 dark:border-red-800",
        pulseClass: "shadow-red-200 dark:shadow-red-900/50"
    },
    medium: {
        label: "Medium",
        textClass: "text-amber-700 dark:text-amber-400",
        bgClass: "bg-amber-50 dark:bg-amber-900/20",
        borderClass: "border-amber-200 dark:border-amber-800",
        pulseClass: "shadow-amber-200 dark:shadow-amber-900/50"
    },
    low: {
        label: "Low",
        textClass: "text-blue-700 dark:text-blue-400",
        bgClass: "bg-blue-50 dark:bg-blue-900/20",
        borderClass: "border-blue-200 dark:border-blue-800",
        pulseClass: "shadow-blue-200 dark:shadow-blue-900/50"
    }
} as const;

const SEVERITY_ORDER: (keyof IssueCounts)[] = ["critical", "high", "medium", "low"];

function AnimatedCount({ value, colorClass, delay = 0 }: { value: number; colorClass: string; delay?: number }) {
    const countupRef = useRef<HTMLSpanElement>(null);
    const [hasCompleted, setHasCompleted] = useState(false);

    useEffect(() => {
        const el = countupRef.current;
        if (!el) {
            return;
        }

        let isCancelled = false;

        // Delay the animation to sync with card entrance
        const timeoutId = setTimeout(() => {
            if (isCancelled) {
                return;
            }

            import("countup.js")
                .then((countUpModule) => {
                    if (isCancelled || !countupRef.current) {
                        return;
                    }

                    const countUp = new countUpModule.CountUp(countupRef.current, value, {
                        startVal: 0,
                        duration: 1.2,
                        useEasing: true,
                        useGrouping: true,
                        separator: ","
                    });

                    if (!countUp.error) {
                        countUp.start(() => {
                            if (!isCancelled) {
                                setHasCompleted(true);
                                setTimeout(() => setHasCompleted(false), 300);
                            }
                        });
                    } else {
                        console.error("CountUp error:", countUp.error);
                        if (countupRef.current) {
                            countupRef.current.textContent = String(value);
                        }
                    }
                })
                .catch((err) => {
                    console.error("Failed to load CountUp:", err);
                    if (countupRef.current) {
                        countupRef.current.textContent = String(value);
                    }
                });
        }, delay);

        return () => {
            isCancelled = true;
            clearTimeout(timeoutId);
        };
    }, [value, delay]);

    return (
        <span
            ref={countupRef}
            className={cn(
                "text-2xl font-bold tabular-nums transition-transform duration-300",
                colorClass,
                hasCompleted && value > 0 && "scale-110",
                !hasCompleted && "scale-100"
            )}
        >
            0
        </span>
    );
}

export default function SeveritySummary({ issueCounts, isProcessing }: SeveritySummaryProps) {
    if (isProcessing) {
        return (
            <div className="animate-in fade-in flex flex-col items-center gap-4 py-8 duration-300">
                <div className="relative">
                    {/* Outer pulsing ring */}
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2s]" />
                    {/* Main spinner */}
                    <div className="relative h-10 w-10 animate-spin rounded-full border-[3px] border-muted-foreground/20 border-t-primary [animation-duration:1s]" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-foreground">Analyzing your documentation</span>
                    <span className="flex gap-1 text-sm text-muted-foreground">
                        {[".", ".", "."].map((dot, i) => (
                            <span
                                key={i}
                                className="animate-bounce"
                                style={{
                                    animationDelay: `${i * 150}ms`,
                                    animationDuration: "1s"
                                }}
                            >
                                {dot}
                            </span>
                        ))}
                    </span>
                </div>
            </div>
        );
    }

    if (!issueCounts) {
        return (
            <div className="flex flex-col items-center gap-2 py-8">
                <span className="text-sm text-muted-foreground">No data available</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-4 gap-4">
            {SEVERITY_ORDER.map((severity, index) => {
                const count = issueCounts[severity];
                const config = SEVERITY_CONFIG[severity];
                const hasIssues = count > 0;

                return (
                    <div
                        key={severity}
                        className={cn(
                            "flex flex-col items-center rounded-xl border p-5 transition-all duration-500",
                            hasIssues ? config.bgClass : "bg-muted/30",
                            hasIssues ? config.borderClass : "border-border",
                            hasIssues && "hover:scale-[1.02] hover:shadow-md",
                            hasIssues ? "health-card-pulse" : "animate-in fade-in slide-in-from-bottom-2"
                        )}
                        style={
                            hasIssues
                                ? ({
                                      "--pulse-color":
                                          severity === "low"
                                              ? "rgb(59 130 246 / 0.35)"
                                              : severity === "medium"
                                                ? "rgb(245 158 11 / 0.35)"
                                                : "rgb(239 68 68 / 0.35)"
                                  } as React.CSSProperties)
                                : {
                                      animationDelay: `${index * 100}ms`,
                                      animationFillMode: "backwards",
                                      animationDuration: "400ms"
                                  }
                        }
                    >
                        <AnimatedCount
                            value={count}
                            colorClass={hasIssues ? config.textClass : "text-muted-foreground"}
                            delay={index * 100 + 200}
                        />
                        <span
                            className={cn(
                                "mt-1 text-xs font-medium transition-colors duration-300",
                                hasIssues ? config.textClass : "text-muted-foreground"
                            )}
                        >
                            {config.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
