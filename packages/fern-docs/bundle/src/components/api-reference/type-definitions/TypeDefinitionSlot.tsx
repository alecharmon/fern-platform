"use client";

import {
    getTypeIdWithLocation,
    isSlotData,
    type PropertyLocation,
    useTypeDefinitionSlots
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionSlotsClient";

import { TypeReferenceDefinitions } from "./TypeReferenceDefinitions";

/**
 * Bundle-specific TypeDefinitionSlot that can render both JSX and data slots.
 * When a slot contains data (lazy approach), it renders TypeReferenceDefinitions on-demand.
 * When a slot contains JSX (legacy approach), it returns the pre-rendered JSX.
 */
export function TypeDefinitionSlot({
    id,
    location,
    isGraphQL = false
}: {
    id: string;
    location: PropertyLocation | undefined;
    isGraphQL?: boolean;
}) {
    const augmentedId = location ? getTypeIdWithLocation(id, location) : id;
    const slotValue = useTypeDefinitionSlots(augmentedId);

    // If slot is data, render on-demand
    if (isSlotData(slotValue)) {
        return (
            <TypeReferenceDefinitions
                shape={slotValue.shape}
                types={slotValue.types}
                location={slotValue.location}
                lang={slotValue.lang}
                showUnionsAsDropdown={slotValue.showUnionsAsDropdown}
                isGraphQL={slotValue.isGraphQL ?? isGraphQL}
            />
        );
    }

    // Legacy path: slot is pre-rendered JSX
    return slotValue as React.ReactNode;
}
