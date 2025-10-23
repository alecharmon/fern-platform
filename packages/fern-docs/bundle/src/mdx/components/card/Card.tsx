import { cn } from "@fern-docs/components/cn";
import { NoZoom } from "@fern-docs/components/contexts/NoZoom";
import { FernCard } from "@fern-docs/components/FernCard";
import { FernImage } from "@fern-docs/components/FernImage";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { isValidElement } from "react";

import { DisableFernAnchor } from "@/components/FernAnchor";
import { FernLinkCard } from "@/components/FernLinkCard";

import { Badge } from "../badge";

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
        className?: string;

        // in-development:
        badge?: string;

        src?: string;
        imageWidth?: string;
        imageHeight?: string;
        imagePosition?: "top" | "left" | "right" | "bottom";
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
    badge,
    className,
    src,
    imageWidth,
    imageHeight,
    imagePosition = "top"
}) => {
    if (isNaN(iconSize)) {
        iconSize = 8;
    }

    const hasImage = src != null;

    const combinedClassName = cn(
        "not-prose rounded-3 relative block border text-base",
        {
            "p-6": !hasImage,
            "overflow-hidden": hasImage
        },
        className
    );

    const imageStyle: React.CSSProperties = {};
    if (hasImage) {
        if (imageWidth && imageHeight) {
            imageStyle.width = imageWidth;
            imageStyle.height = imageHeight;
        } else if (imageWidth) {
            imageStyle.width = imageWidth;
            imageStyle.height = "auto";
        } else if (imageHeight) {
            imageStyle.height = imageHeight;
            imageStyle.width = "auto";
        }
    }

    const cardContent = (
        <>
            {badge != null && (
                <Badge intent="primary" className="absolute -right-2 -top-2">
                    {badge}
                </Badge>
            )}
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
                ) : isValidElement(icon) ? (
                    <span className="card-icon">
                        <NoZoom>{icon}</NoZoom>
                    </span>
                ) : null}
                <div className="w-full space-y-1 overflow-hidden">
                    <div className="text-body text-base font-semibold">{title}</div>
                    {children != null && <div className="text-(color:--grayscale-a11)">{children}</div>}
                </div>
            </div>
        </>
    );

    const content = hasImage ? (
        <>
            <div
                className={cn("flex w-full h-full items-start justify-between", {
                    "flex-col": imagePosition === "top",
                    "flex-row": imagePosition === "left",
                    "flex-row-reverse": imagePosition === "right",
                    "flex-col-reverse": imagePosition === "bottom"
                })}
            >
                <div className="w-full h-full flex items-center justify-center">
                    <FernImage
                        src={src}
                        alt={title}
                        style={Object.keys(imageStyle).length > 0 ? imageStyle : undefined}
                        className="card-image"
                    />
                </div>
                <div className="w-full h-full space-y-1 overflow-hidden p-6">{cardContent}</div>
            </div>
        </>
    ) : (
        cardContent
    );

    if (href != null) {
        return (
            <FernLinkCard className={combinedClassName} scroll={true} href={href}>
                <NoZoom>
                    <DisableFernAnchor>{content}</DisableFernAnchor>
                </NoZoom>
            </FernLinkCard>
        );
    }
    return <FernCard className={combinedClassName}>{content}</FernCard>;
};
