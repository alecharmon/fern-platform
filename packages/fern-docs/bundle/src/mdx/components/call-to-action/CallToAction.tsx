import { cn } from "@fern-docs/components/cn";
import { NoZoom } from "@fern-docs/components/contexts/NoZoom";
import { FernCard } from "@fern-docs/components/FernCard";
import { FernImage } from "@fern-docs/components/FernImage";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";
import { FernSvgIcon } from "@fern-docs/components/FernSvgIcon";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { processIconString } from "@fern-docs/components/util/processIconString";
import { isValidElement } from "react";

export declare namespace CallToAction {
    export interface Props {
        title?: string;
        icon?: unknown;
        iconSize?: number; // size in 0.25rem increments. default is 4.
        color?: string; // ignored if lightModeColor and darkModeColor are set
        darkModeColor?: string;
        lightModeColor?: string;

        children?: string;
        href: string;
        iconPosition?: "top" | "left";
        buttonText?: string;
        buttonPosition?: "right" | "bottom";
        buttonIcon?: string;
        buttonIconSize?: number;
        className?: string;
        target?: string;
    }
}

export const CallToAction: React.FC<CallToAction.Props> = ({
    title,
    icon,
    iconSize = 8,
    color,
    darkModeColor,
    lightModeColor,
    iconPosition = "top",
    children,
    href,
    buttonText,
    buttonPosition = "right",
    buttonIcon,
    buttonIconSize = 8,
    className,
    target = "_blank"
}) => {
    if (isNaN(iconSize)) {
        iconSize = 8;
    }

    if (isNaN(buttonIconSize)) {
        buttonIconSize = 8;
    }

    if (!href) {
        return null;
    }

    const combinedClassName = cn("not-prose rounded-3 relative block border p-6 text-base", className);

    const content = (
        <div
            className={cn("flex w-full h-full justify-between", {
                "flex-col items-start space-y-3": buttonPosition === "bottom",
                "flex-row items-center space-x-3": buttonPosition === "right"
            })}
        >
            <div
                className={cn("flex w-full h-full items-start justify-between", {
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
                    processIconString({
                        icon,
                        className: "card-icon",
                        renderFaIcon: (faIcon) => <FaIcon className="card-icon" icon={faIcon} />,
                        renderUrlIcon: (url, isSvg) =>
                            isSvg ? (
                                <NoZoom>
                                    <FernSvgIcon src={url} alt="" className="card-icon" />
                                </NoZoom>
                            ) : (
                                <NoZoom>
                                    <FernImage src={url} alt="" className="card-icon" />
                                </NoZoom>
                            ),
                        wrap: (content) => <NoZoom>{content}</NoZoom>
                    })
                ) : isValidElement(icon) ? (
                    <span className="card-icon">
                        <NoZoom>{icon}</NoZoom>
                    </span>
                ) : null}
                <div className="w-full space-y-1 overflow-hidden">
                    {title && <div className="text-body text-base font-semibold">{title}</div>}
                    {children != null && <div className="text-(color:--grayscale-a11)">{children}</div>}
                </div>
            </div>
            <div className="w-full h-full flex items-center justify-center">
                <FernLinkButton
                    href={new URL(href)}
                    target={target}
                    rightIcon={buttonIcon}
                    variant="filled"
                    intent="primary"
                    text={buttonText}
                />
            </div>
        </div>
    );

    return <FernCard className={combinedClassName}>{content}</FernCard>;
};
