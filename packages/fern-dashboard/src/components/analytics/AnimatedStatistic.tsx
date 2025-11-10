"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/utils/utils";

interface AnimatedStatisticProps {
    label: string;
    value: number;
    suffix?: string;
    decimals?: number;
    colorClass?: string;
}

export function AnimatedStatistic({
    label,
    value,
    suffix = "",
    decimals = 0,
    colorClass = ""
}: AnimatedStatisticProps) {
    const countupRef = useRef<HTMLSpanElement>(null);
    const countUpAnimRef = useRef<any>(null);
    const previousValueRef = useRef<number>(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: only value is a dependency of the effect
    useEffect(() => {
        initCountUp();

        return () => {
            if (countUpAnimRef.current) {
                countUpAnimRef.current.reset();
            }
        };
    }, [value]);

    async function initCountUp() {
        if (!countupRef.current) {
            return;
        }

        try {
            const countUpModule = await import("countup.js");

            if (countUpAnimRef.current) {
                countUpAnimRef.current.reset();
            }

            const startValue = previousValueRef.current;

            countUpAnimRef.current = new countUpModule.CountUp(countupRef.current, value, {
                startVal: startValue,
                duration: 1.5,
                separator: ",",
                useEasing: true,
                useGrouping: true,
                decimal: ".",
                decimalPlaces: decimals,
                suffix: suffix
            });

            if (!countUpAnimRef.current.error) {
                countUpAnimRef.current.start();
                previousValueRef.current = value;
            } else {
                console.error(countUpAnimRef.current.error);
                if (countupRef.current) {
                    countupRef.current.textContent =
                        decimals > 0
                            ? `${value.toFixed(decimals)}${suffix}`
                            : `${new Intl.NumberFormat("en-US").format(value)}${suffix}`;
                }
            }
        } catch (err) {
            console.error("Failed to load CountUp.js:", err);
            if (countupRef.current) {
                countupRef.current.textContent =
                    decimals > 0
                        ? `${value.toFixed(decimals)}${suffix}`
                        : `${new Intl.NumberFormat("en-US").format(value)}${suffix}`;
            }
        }
    }

    return (
        <div className="flex flex-1 flex-col items-start">
            <span className="text-gray-1100 mb-1 text-sm">{label}</span>
            <span ref={countupRef} className={cn("text-xl font-bold", colorClass)}>
                0{suffix}
            </span>
        </div>
    );
}
