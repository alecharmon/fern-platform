"use client";

import type { Editor } from "@tiptap/react";
import { Check } from "lucide-react";
import type * as React from "react";

// --- UI Primitives ---
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button";

import type { TurnIntoItem } from "./use-turn-into-dropdown";

interface TurnIntoMenuProps {
    editor: Editor;
    items: TurnIntoItem[];
    onSelect: (item: TurnIntoItem) => void;
}

export const TurnIntoMenu: React.FC<TurnIntoMenuProps> = ({ editor, items, onSelect }) => {
    if (!items.length) {
        return null;
    }

    return (
        <ButtonGroup className="gap-px p-1">
            {items.map((item) => {
                const BadgeIcon = item.badge;
                const isActive = item.isActive?.(editor) ?? false;

                return (
                    <Button
                        key={item.title}
                        className="cursor-pointer"
                        data-style="ghost"
                        data-active-state={isActive ? "on" : "off"}
                        onClick={() => onSelect(item)}
                    >
                        {BadgeIcon && <BadgeIcon className="tiptap-button-icon" />}
                        <div className="tiptap-button-text">{item.title}</div>
                        {isActive && <Check className="h-4 w-4 ml-auto" />}
                    </Button>
                );
            })}
        </ButtonGroup>
    );
};
