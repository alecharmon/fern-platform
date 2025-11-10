import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

interface CardGroupContextValue {
    registerCard: () => void;
    unregisterCard: () => void;
    cardCount: number;
}

const CardGroupContext = createContext<CardGroupContextValue | null>(null);

export function useCardGroup() {
    return useContext(CardGroupContext);
}

export function useIsWithinCardGroup() {
    const context = useCardGroup();
    return context != null;
}

export function CardGroupProvider({ children }: { children: React.ReactNode }) {
    const [registeredCards, setRegisteredCards] = useState<number>(0);

    const registerCard = useCallback(() => {
        setRegisteredCards((prev) => prev + 1);
    }, []);

    const unregisterCard = useCallback(() => {
        setRegisteredCards((prev) => prev - 1);
    }, []);

    const value: CardGroupContextValue = {
        registerCard,
        unregisterCard,
        cardCount: registeredCards
    };

    return <CardGroupContext.Provider value={value}>{children}</CardGroupContext.Provider>;
}
