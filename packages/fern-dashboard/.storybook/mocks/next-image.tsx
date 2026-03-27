import type { ImgHTMLAttributes } from "react";

/**
 * Storybook mock for next/image that renders a plain <img> tag.
 */
function NextImage({ src, alt, width, height, className, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src={typeof src === "string" ? src : undefined}
            alt={alt}
            width={width}
            height={height}
            className={className}
            {...rest}
        />
    );
}

export default NextImage;
