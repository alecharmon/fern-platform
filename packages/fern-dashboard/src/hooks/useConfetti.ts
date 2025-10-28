"use client";

import confetti from "canvas-confetti";
import { useCallback } from "react";

export function useConfetti() {
    const startConfetti = useCallback(() => {
        const defaults = { startVelocity: 80, ticks: 60, zIndex: 1000 };
        const particleCount = 25;
        const duration = 800;
        const animationEnd = Date.now() + duration;

        const interval = setInterval(() => {
            if (Date.now() > animationEnd) {
                clearInterval(interval);
                return;
            }

            // Launch confetti from bottom corners at ~60 degree angle upward
            void confetti({
                ...defaults,
                particleCount,
                origin: { x: 0, y: 1 },
                angle: 60,
                spread: 55
            });
            void confetti({
                ...defaults,
                particleCount,
                origin: { x: 1, y: 1 },
                angle: 120,
                spread: 55
            });
        }, 100);
        return () => {
            clearInterval(interval);
        };
    }, []);
    return {
        startConfetti
    };
}
