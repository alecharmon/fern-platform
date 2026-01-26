"use client";

import React from "react";

import { getTypeIdWithLocation, type PropertyLocation } from "./utils";

export { getTypeIdWithLocation, type PropertyLocation };

const TypeDefinitionSlots = React.createContext<Record<string, React.ReactNode>>({});

export function TypeDefinitionSlotsProvider({
    slots,
    children
}: {
    slots: Record<string, React.ReactNode>;
    children: React.ReactNode;
}) {
    return <TypeDefinitionSlots.Provider value={slots}>{children}</TypeDefinitionSlots.Provider>;
}

export function useTypeDefinitionSlots(id: string) {
    return React.useContext(TypeDefinitionSlots)[id];
}

export function TypeDefinitionSlot({
    id,
    location,
    isGraphQL: _isGraphQL
}: {
    id: string;
    location: PropertyLocation | undefined;
    isGraphQL?: boolean;
}) {
    const augmentedId = location ? getTypeIdWithLocation(id, location) : id;
    return useTypeDefinitionSlots(augmentedId);
}
