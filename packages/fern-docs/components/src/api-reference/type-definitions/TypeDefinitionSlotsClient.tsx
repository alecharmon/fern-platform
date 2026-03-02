"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import React from "react";

import { getTypeIdWithLocation, type PropertyLocation } from "./utils";

export { getTypeIdWithLocation, type PropertyLocation };

/**
 * Slot data for lazy rendering (used when remote rendering is enabled).
 * Instead of pre-rendered JSX, we store the raw data needed to render on-demand.
 */
export interface TypeDefinitionSlotData {
    shape: ApiDefinition.TypeShape;
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
    location?: PropertyLocation;
    showUnionsAsDropdown?: boolean;
    isGraphQL?: boolean;
}

/**
 * Slot value can be either:
 * - React.ReactNode (legacy JSX-based approach)
 * - TypeDefinitionSlotData (lazy data-based approach)
 */
export type TypeDefinitionSlotValue = React.ReactNode | TypeDefinitionSlotData;

const TypeDefinitionSlots = React.createContext<Record<string, TypeDefinitionSlotValue>>({});

export function TypeDefinitionSlotsProvider({
    slots,
    children
}: {
    slots: Record<string, TypeDefinitionSlotValue>;
    children: React.ReactNode;
}) {
    return <TypeDefinitionSlots.Provider value={slots}>{children}</TypeDefinitionSlots.Provider>;
}

export function useTypeDefinitionSlots(id: string): TypeDefinitionSlotValue {
    return React.useContext(TypeDefinitionSlots)[id];
}

/**
 * Helper to check if a slot value is data (not JSX)
 */
export function isSlotData(value: TypeDefinitionSlotValue): value is TypeDefinitionSlotData {
    return (
        value != null &&
        typeof value === "object" &&
        !React.isValidElement(value) &&
        "shape" in value &&
        "types" in value &&
        "lang" in value
    );
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
    const slotValue = useTypeDefinitionSlots(augmentedId);

    // If slot is data, render on-demand using lazy import
    // This will be implemented in the bundle package since it needs TypeReferenceDefinitions
    if (isSlotData(slotValue)) {
        // TypeReferenceDefinitions must be imported dynamically in the bundle
        // This component is in the shared package, so we return a placeholder
        // that the bundle will override via the slot renderer
        return null;
    }

    // Legacy path: slot is pre-rendered JSX
    return slotValue as React.ReactNode;
}
