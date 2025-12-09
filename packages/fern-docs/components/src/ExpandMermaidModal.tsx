"use client";

import { X } from "lucide-react";
import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "./cn";
import { Button } from "./FernButtonV2";

export declare namespace ExpandMermaidModal {
    export interface Props {
        svgContent: string;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
    }
}

export const ExpandMermaidModal: React.FC<ExpandMermaidModal.Props> = ({ svgContent, open, onOpenChange }) => {
    const [mounted, setMounted] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        if (!open) {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
        }
    }, [open]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onOpenChange?.(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            onOpenChange?.(false);
        }
    };

    const handleZoomClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) {
            return;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        if (zoom === 1) {
            const targetZoom = 2;
            const dx = centerX - clickX;
            const dy = centerY - clickY;
            setZoom(targetZoom);
            setOffset({ x: dx, y: dy });
        } else {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
        }
    };

    if (!open || !mounted) {
        return null;
    }

    const modalContent = (
        <div className="fixed inset-0 top-[var(--header-height)] z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={handleBackdropClick} />
            <div
                className="bg-card-solid rounded-3 shadow-card-grayscale relative mx-4 flex h-full max-h-[80vh] w-full max-w-[80vw] flex-col overflow-hidden"
                onKeyDown={handleKeyDown}
            >
                <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
                    <Button variant="ghost" size="iconSm" onClick={() => onOpenChange?.(false)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-hidden p-6">
                    <div
                        ref={containerRef}
                        className={cn("relative h-full w-full", zoom === 1 ? "cursor-zoom-in" : "cursor-zoom-out")}
                        onClick={handleZoomClick}
                    >
                        <div
                            className="mermaid-container-expanded flex items-center justify-center transition-transform duration-150 ease-out h-full w-full [&_svg]:max-w-full [&_svg]:max-h-full"
                            style={{
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                transformOrigin: "center center"
                            }}
                            dangerouslySetInnerHTML={{ __html: svgContent }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
