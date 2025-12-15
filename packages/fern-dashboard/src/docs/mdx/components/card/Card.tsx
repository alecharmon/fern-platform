import { cn } from "@fern-docs/components/cn";
import { NoZoom } from "@fern-docs/components/contexts/NoZoom";
import { DisableFernAnchor } from "@fern-docs/components/FernAnchor";
import { FernCard } from "@fern-docs/components/FernCard";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { cloneElement, isValidElement, type ReactElement, useEffect, useRef } from "react";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";
import { FernLinkCard } from "@/docs/components/FernLinkCard";
import { useFileResolver } from "@/providers/FileResolverContext";

import { Badge } from "../badge";
import { useCardGroup } from "./CardGroupContext";

export declare namespace Card {
    export interface Props {
        title: string;
        icon?: unknown;
        iconSize?: number; // size in 0.25rem increments. default is 4.
        color?: string; // ignored if lightModeColor and darkModeColor are set
        darkModeColor?: string;
        lightModeColor?: string;

        children?: string;
        href?: string;
        iconPosition?: "top" | "left";

        // in-development:
        badge?: string;
    }
}

export const Card: React.FC<Card.Props> = ({
    title,
    icon,
    iconSize = 8,
    color,
    darkModeColor,
    lightModeColor,
    iconPosition = "top",
    children,
    href,
    badge
}) => {
    const { isWithinEditor } = useEditorComponent();
    const popoverRef = useRef<HTMLDivElement>(null);
    const cardGroup = useCardGroup();
    const { resolveFileSrc } = useFileResolver();

    // Resolve image src in icon if it's a React element with a src prop
    const resolvedIcon = (() => {
        if (!isValidElement(icon)) {
            return icon;
        }

        const element = icon as ReactElement<{ src?: unknown }>;
        const src = element.props.src;
        if (typeof src !== "string" || src.trim() === "") {
            return element;
        }

        const resolved = resolveFileSrc(src);
        const resolvedSrc = resolved?.src ?? src;

        if (resolvedSrc === src) {
            return element;
        }

        return cloneElement(element, { src: resolvedSrc });
    })();

    // Register/unregister with CardGroup if within one
    useEffect(() => {
        if (cardGroup) {
            cardGroup.registerCard();
            return () => {
                cardGroup.unregisterCard();
            };
        }
        return undefined;
    }, [cardGroup]);

    if (isNaN(iconSize)) {
        iconSize = 8;
    }

    const className = cn("not-prose rounded-3 relative block border p-6 text-base");

    const content = (
        <div ref={popoverRef} className="relative">
            <div className="absolute -right-4 -top-4 flex items-center gap-1">
                {isWithinEditor && <EditorComponentPopoverButton className="h-full" componentName="Card" />}
                {badge != null && <Badge intent="primary">{badge}</Badge>}
            </div>
            <div
                className={cn("flex items-start", {
                    "flex-col space-y-3": iconPosition === "top",
                    "flex-row space-x-3": iconPosition === "left"
                })}
            >
                <style jsx>
                    {`
            div > :global(.card-icon) {
              color: ${lightModeColor ?? color ?? "var(--accent-a10)"};
              width: ${iconSize * 4}px;
              height: ${iconSize * 4}px;
            }

            div > :global(.card-icon:is(.dark *)) {
              color: ${darkModeColor ?? color ?? "var(--accent-a10)"};
            }
          `}
                </style>
                {typeof icon === "string" ? (
                    <FaIcon className="card-icon" icon={icon} />
                ) : isValidElement(resolvedIcon) ? (
                    <span className="card-icon">
                        <NoZoom>{resolvedIcon}</NoZoom>
                    </span>
                ) : null}
                <div className="w-full space-y-1">
                    <div className="text-body text-base font-semibold">{title}</div>
                    {children != null && (
                        <div
                            className={cn(
                                "text-(color:--grayscale-a11)",
                                isWithinEditor && "solid-hover-handle -ml-8 -mt-2"
                            )}
                        >
                            {children}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const cardElement =
        href != null && !isWithinEditor ? (
            <FernLinkCard className={className} scroll={true} href={href}>
                <NoZoom>
                    <DisableFernAnchor>{content}</DisableFernAnchor>
                </NoZoom>
            </FernLinkCard>
        ) : (
            <FernCard className={className}>{content}</FernCard>
        );

    if (!isWithinEditor) {
        return cardElement;
    }

    return (
        <EditorComponentPopoverProvider
            attributes={{
                title: new TextInputControl({ defaultValue: title }),
                ...(typeof icon === "string" ? { icon: new TextInputControl({ defaultValue: icon }) } : {}),
                href: new TextInputControl({ defaultValue: href || "", label: "Link" }),
                badge: new TextInputControl({ defaultValue: badge || "" })
            }}
            targetRef={popoverRef}
            hoverSlopThreshold={20}
        >
            {cardElement}
        </EditorComponentPopoverProvider>
    );
};
