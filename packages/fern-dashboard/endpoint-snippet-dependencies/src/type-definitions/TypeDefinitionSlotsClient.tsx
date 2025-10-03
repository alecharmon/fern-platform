"use client";

import React from "react";

import { getTypeIdWithLocation } from "./TypeDefinitionSlotsServer";
import { PropertyLocation } from "./TypeReferenceDefinitions";

const TypeDefinitionSlots = React.createContext<
  Record<string, React.ReactNode>
>({});

export function TypeDefinitionSlotsProvider({
  slots,
  children,
}: {
  slots: Record<string, React.ReactNode>;
  children: React.ReactNode;
}) {
  return (
    <TypeDefinitionSlots.Provider value={slots}>
      {children}
    </TypeDefinitionSlots.Provider>
  );
}

export function useTypeDefinitionSlots(id: string) {
  return React.useContext(TypeDefinitionSlots)[id];
}

export function TypeDefinitionSlot({
  id,
  location,
}: {
  id: string;
  location: PropertyLocation | undefined;
}) {
  const augmentedId = location ? getTypeIdWithLocation(id, location) : id;
  return useTypeDefinitionSlots(augmentedId);
}
