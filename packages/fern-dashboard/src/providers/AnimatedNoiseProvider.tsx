"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

interface AnimatedNoiseContextType {
    isAnimated: boolean;
    setIsAnimated: (animated: boolean) => void;
}

const AnimatedNoiseContext = createContext<AnimatedNoiseContextType | undefined>(undefined);

export function AnimatedNoiseProvider({ children }: { children: React.ReactNode }) {
    const [isAnimated, setIsAnimated] = useState(false);

    const value = {
        isAnimated,
        setIsAnimated: useCallback((animated: boolean) => {
            setIsAnimated(animated);
        }, [])
    };

    return <AnimatedNoiseContext.Provider value={value}>{children}</AnimatedNoiseContext.Provider>;
}

export function useAnimatedNoise() {
    const context = useContext(AnimatedNoiseContext);
    if (context === undefined) {
        throw new Error("useAnimatedNoise must be used within an AnimatedNoiseProvider");
    }
    return context;
}
