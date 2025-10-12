"use client";

import { Expand } from "lucide-react";
import { useState } from "react";
import { cn } from "./cn";
import { ExpandCodeModal } from "./ExpandCodeModal";
import { Button } from "./FernButtonV2";

export declare namespace ExpandCodeButton {
    export interface Props {
        className?: string;
        language?: string;
        content?: string | (() => string | Promise<string>);
    }
}

export const ExpandCodeButton: React.FC<ExpandCodeButton.Props> = ({ className, content, language }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (content == null) {
        return null;
    }

    return (
        <>
            <Button
                className={cn("fern-expand-button", className)}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(true);
                }}
                variant="ghost"
                size="iconSm"
            >
                <Expand />
            </Button>
            <ExpandCodeModal code={content} language={language} open={isOpen} onOpenChange={setIsOpen} />
        </>
    );
};
