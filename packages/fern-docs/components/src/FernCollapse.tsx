import { isomorphicRequestAnimationFrame } from "@fern-ui/react-commons";
import * as Collapsible from "@radix-ui/react-collapsible";
import { noop } from "es-toolkit/function";
import type { FC, PropsWithChildren, ReactNode } from "react";
import React from "react";

interface FernCollapseProps extends Collapsible.CollapsibleProps {
    open?: boolean;
    className?: string;
    trigger?: ReactNode;
}

export enum AnimationStates {
    OPEN_START,
    OPEN,
    CLOSING_START,
    CLOSED
}

export const FernCollapse: FC<PropsWithChildren<FernCollapseProps>> = ({ children, trigger, ...props }) => {
    return (
        <Collapsible.Root {...props}>
            {trigger && <Collapsible.Trigger asChild>{trigger}</Collapsible.Trigger>}
            <Collapsible.Content className="fern-collapsible" {...useFernCollapseOverflow()}>
                <div className="fern-collapsible-child">{children}</div>
            </Collapsible.Content>
        </Collapsible.Root>
    );
};

export function useFernCollapseOverflow() {
    const ref = React.useRef<HTMLDivElement>(null);
    const animationFrameRef = React.useRef<() => void>(noop);
    return {
        ref,
        onAnimationStart: (event: React.AnimationEvent) => {
            // Ignore bubbled animation events from child collapsibles
            if (event.target !== event.currentTarget) {
                return;
            }
            animationFrameRef.current();
            animationFrameRef.current = isomorphicRequestAnimationFrame(() => {
                if (ref.current != null) {
                    ref.current.style.overflow = "hidden";
                }
            });
        },
        onAnimationEnd: (event: React.AnimationEvent) => {
            // Ignore bubbled animation events from child collapsibles
            if (event.target !== event.currentTarget) {
                return;
            }
            animationFrameRef.current();
            // Only restore overflow to visible after opening animations.
            // After closing, keep overflow hidden to prevent a layout shift
            // in the brief moment before the element is removed from the DOM.
            if (event.currentTarget instanceof HTMLElement && event.currentTarget.dataset.state === "closed") {
                return;
            }
            animationFrameRef.current = isomorphicRequestAnimationFrame(() => {
                if (ref.current != null) {
                    ref.current.style.overflow = "visible";
                }
            });
        }
    };
}
