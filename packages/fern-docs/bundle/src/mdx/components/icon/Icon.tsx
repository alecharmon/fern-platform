import { cn } from "@fern-docs/components/cn";
import { FernImage } from "@fern-docs/components/FernImage";
import { FernSvgIcon } from "@fern-docs/components/FernSvgIcon";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { processIconString } from "@fern-docs/components/util/processIconString";

export function Icon({
    className,
    icon,
    size = 4,
    color,
    darkModeColor,
    lightModeColor
}: {
    className?: string; // you must specify the bg-color rather than text-color because this is a mask.
    icon?: string; // e.g. "fas fa-home", or simply "home", or a URL (file: references are resolved by rehype-files)
    color?: string; // ignored if lightModeColor and darkModeColor are set
    darkModeColor?: string;
    lightModeColor?: string;
    size?: number; // size in 0.25rem increments. default is 4.
}) {
    const sizeInPixels = size * 4;

    if (typeof icon !== "string" || !icon) {
        return null;
    }

    return (
        processIconString({
            icon,
            className: cn(className, "fern-mdx-icon"),
            renderFaIcon: (faIcon) => (
                <FaIcon
                    className={cn(className, "fern-mdx-icon")}
                    icon={faIcon}
                    style={
                        {
                            color: lightModeColor ?? color,
                            "--fa-icon-dark": darkModeColor ?? color,
                            width: sizeInPixels,
                            height: sizeInPixels
                        } as React.CSSProperties
                    }
                />
            ),
            renderUrlIcon: (url, isSvg) =>
                isSvg ? (
                    <span
                        className={cn(className, "fern-mdx-icon")}
                        style={{
                            width: sizeInPixels,
                            height: sizeInPixels,
                            display: "inline-block"
                        }}
                    >
                        <FernSvgIcon src={url} alt="" />
                    </span>
                ) : (
                    <FernImage
                        src={url}
                        alt=""
                        className={cn(className, "fern-mdx-icon")}
                        style={{
                            width: sizeInPixels,
                            height: sizeInPixels
                        }}
                    />
                ),
            wrap: (content) => <>{content}</>
        }) ?? null
    );
}
