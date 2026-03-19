import Image from "next/image";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { UnreachableCaseError } from "ts-essentials";

import { ImageErrorTracker } from "./ImageErrorTracker";

// TODO: move this to a shared location
const NEXT_IMAGE_HOSTS = [
    "fdr-prod-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-prod-docs-files-public.s3.amazonaws.com",
    "fdr-dev2-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-dev2-docs-files-public.s3.amazonaws.com",
    "files.buildwithfern.com",
    "files-dev2.buildwithfern.com"
];

/**
 * When NEXT_PUBLIC_ASSET_HOSTING is enabled, file URLs are rewritten from
 * https://files.buildwithfern.com/... to /_files/... so all assets load through
 * the customer's own domain (bypasses strict firewalls/proxies). These relative
 * paths are still optimizable by Next.js Image since /_next/image fetches them
 * from the local server, which the middleware proxies back to the CDN.
 */
function isAssetHostedPath(src: string): boolean {
    return src.startsWith("/_files/") || src.includes("/_files/");
}

export const FernImage = forwardRef<
    HTMLImageElement,
    ComponentPropsWithoutRef<typeof Image> & { isAirgapped?: boolean }
>((props, ref) => {
    const {
        src,
        alt,
        width,
        height,
        fill,
        loader,
        quality,
        priority,
        loading,
        placeholder,
        blurDataURL,
        unoptimized,
        overrideSrc,
        onLoadingComplete,
        layout,
        objectFit,
        objectPosition,
        lazyBoundary,
        lazyRoot,
        isAirgapped,
        ...rest
    } = props;

    if (src == null) {
        return null;
    }

    const originalSrc = getSrc(src);
    const { host, pathname } = safeGetUrl(originalSrc);

    const aspectRatio = withAspectRatio(withDimensions(props));

    // nextjs requires a strict allowlist of hosts for <Image>
    // so we'll fall back to <img> if the host is not in the allowlist (or if no custom loader is provided)
    // /_files/ paths are relative and don't need to be in the allowlist — Next.js optimizes them natively
    if (
        ((!host || !NEXT_IMAGE_HOSTS.includes(host)) && !loader && !isAssetHostedPath(originalSrc)) ||
        (!width && !height)
    ) {
        return (
            <ImageErrorTracker src={originalSrc} isAirgapped={isAirgapped}>
                <img
                    ref={ref}
                    {...rest}
                    src={originalSrc}
                    alt={alt}
                    width={width}
                    height={height}
                    fetchPriority={priority ? "high" : undefined}
                    loading={loading}
                    // on local dev, the preflight css for <img> tags is `max-width: 100%; height: auto;`
                    // which causes the image height to be ignored. we'll use the inline style prop to override this behavior:
                    style={{
                        aspectRatio,
                        ...props.style
                    }}
                />
            </ImageErrorTracker>
        );
    }

    // if we're here, we're using the <Image> component
    // we'll use the inline style prop to override the aspect ratio
    // and pass the rest of the props to the <Image> component
    return (
        <ImageErrorTracker src={originalSrc} isAirgapped={isAirgapped}>
            <Image
                ref={ref}
                {...rest}
                src={src}
                alt={alt}
                width={width}
                height={height}
                fill={fill}
                loader={loader}
                quality={quality}
                priority={priority}
                loading={loading}
                placeholder={placeholder}
                blurDataURL={blurDataURL}
                unoptimized={pathname?.endsWith(".gif") || pathname?.endsWith(".svg") || unoptimized}
                overrideSrc={originalSrc}
                onLoadingComplete={onLoadingComplete}
                layout={layout}
                objectFit={objectFit}
                objectPosition={objectPosition}
                lazyBoundary={lazyBoundary}
                lazyRoot={lazyRoot}
                // on local dev, the preflight css for <img> tags is `max-width: 100%; height: auto;`
                // which causes the image height to be ignored. we'll use the inline style prop to override this behavior:
                style={{
                    aspectRatio,
                    ...props.style
                }}
            />
        </ImageErrorTracker>
    );
});

FernImage.displayName = "FernImage";

function safeGetUrl(src: string): {
    host: string | undefined;
    pathname: string | undefined;
} {
    try {
        const url = new URL(src, "https://n");
        return { host: url.host, pathname: url.pathname.toLowerCase() };
    } catch (_e) {
        return { host: undefined, pathname: undefined };
    }
}

function getSrc(src: ComponentPropsWithoutRef<typeof Image>["src"]): string {
    if (typeof src === "string") {
        return src;
    }
    if (typeof src === "object" && "src" in src) {
        return src.src;
    }
    if (typeof src === "object" && "default" in src) {
        return src.default.src;
    }
    throw new UnreachableCaseError(src);
}

function withDimensions(props: ComponentPropsWithoutRef<typeof Image>): { width: number; height: number } | undefined {
    if (props.width != null && props.height != null) {
        return { width: Number(props.width), height: Number(props.height) };
    }
    if (typeof props.src === "object" && "width" in props.src && "height" in props.src) {
        return { width: props.src.width, height: props.src.height };
    }
    if (typeof props.src === "object" && "default" in props.src) {
        return { width: props.src.default.width, height: props.src.default.height };
    }
    return undefined;
}

function withAspectRatio(dimensions: { width: number; height: number } | undefined): number | undefined {
    if (dimensions == null) {
        return undefined;
    }
    return dimensions.width / dimensions.height;
}
