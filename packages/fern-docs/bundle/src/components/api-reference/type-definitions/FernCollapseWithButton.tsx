import { cn } from "@fern-docs/components/cn";
import { FernButton, type FernButtonProps } from "@fern-docs/components/FernButton";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { X } from "lucide-react";
import type { FC, PropsWithChildren, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { useTypeDefinitionContext } from "./TypeDefinitionContext";

interface FernCollapseWithButtonProps {
    isOpen: boolean;
    toggleIsOpen: () => void;
    onOpen?: () => void;
    onClose?: () => void;
    showText: ReactNode;
    hideText: ReactNode;
    buttonProps?: Partial<FernButtonProps>;
}

const MIN_WIDTH_TRIGGER = 160;

export const FernCollapseWithButton: FC<PropsWithChildren<FernCollapseWithButtonProps>> = ({
    isOpen,
    toggleIsOpen,
    onOpen,
    onClose,
    children,
    showText,
    hideText,
    buttonProps
}) => {
    const text = !isOpen ? showText : hideText;
    const { collapsible, isWidthConstrained, setIsWidthConstrained } = useTypeDefinitionContext();
    const containerRef = useRef<HTMLDivElement>(null);

    // Use ResizeObserver to monitor width changes and detect constraints
    useEffect(() => {
        if (!setIsWidthConstrained || !containerRef.current) {
            return;
        }

        const checkWidth = () => {
            if (containerRef.current && isOpen) {
                const width = containerRef.current.getBoundingClientRect().width;
                console.log("[FernCollapse] Width:", width, "isOpen:", isOpen, "collapsible:", collapsible);

                if (width < MIN_WIDTH_TRIGGER) {
                    setIsWidthConstrained(true);

                    // After the constraint style is applied, scroll the element back into view
                    // Use setTimeout to ensure the style changes and reflow are complete
                    setTimeout(() => {
                        containerRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest"
                        });
                    }, 0);
                }
            }
        };

        // Check immediately
        checkWidth();

        // Also observe resize changes
        const resizeObserver = new ResizeObserver(() => {
            checkWidth();
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            // Reset when unmounting or closing (only for root)
            if (!collapsible && !isOpen) {
                setIsWidthConstrained(false);
            }
        };
    }, [isOpen, collapsible, setIsWidthConstrained]);

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            <FernCollapse
                className={cn("fern-collapsible-card", {
                    "fern-collapsible-card-nested": isWidthConstrained
                })}
                open={isOpen}
                onOpenChange={(open) => {
                    if (open) {
                        onOpen?.();
                    } else {
                        onClose?.();
                    }
                }}
                trigger={
                    <FernButton
                        {...buttonProps}
                        className={cn("fern-collapse-trigger text-left", buttonProps?.className)}
                        onClick={(e) => {
                            toggleIsOpen();
                            e.stopPropagation();
                        }}
                        variant="minimal"
                        icon={
                            typeof text === "string" ? (
                                <X
                                    className={cn("transition", {
                                        "rotate-45": !isOpen
                                    })}
                                />
                            ) : null
                        }
                        active={isOpen}
                    >
                        {text}
                    </FernButton>
                }
            >
                {children}
            </FernCollapse>
        </div>
    );
};
