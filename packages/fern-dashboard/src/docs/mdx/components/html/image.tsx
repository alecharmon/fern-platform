"use client";

import { cn } from "@fern-docs/components";
import { NoZoomContext } from "@fern-docs/components/contexts/NoZoom";
import { FernImage } from "@fern-docs/components/FernImage";
import CloudArrowUpIcon from "@heroicons/react/24/outline/CloudArrowUpIcon";
import { ComponentProps, forwardRef, ReactElement, useContext, useRef } from "react";
import Zoom from "react-medium-image-zoom";
import { CheckboxControl, TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";
import { useFrontmatter } from "@/docs/components/contexts/frontmatter";
import { toPixelValue } from "@/docs/components/util/to-pixel-value";
import { useFileResolver } from "@/providers/FileResolverContext";

export const Image = forwardRef<
    HTMLImageElement,
    React.ComponentPropsWithoutRef<"img"> & {
        /**
         * @default false
         */
        noZoom?: boolean;
        /**
         * overrides `noZoom` if true
         * @default false
         */
        enableZoom?: boolean;

        // other props from next/image that are supported
        fill?: boolean | undefined;
        quality?: number | `${number}` | undefined;
        priority?: boolean | undefined;
        loading?: "eager" | "lazy" | undefined;
        blurDataURL?: string | undefined;
        unoptimized?: boolean | undefined;
        // set by rehype-files.ts if image width or height property
        __assigned_imageSize?: React.CSSProperties | undefined;
    }
>((props, ref) => {
    const {
        src,
        alt,
        width,
        height,
        title,
        noZoom: isImageZoomDisabledProp = false,
        enableZoom: isImageZoomEnabledOverride = false,
        style,
        __assigned_imageSize,
        className,
        ...rest
    } = props;

    const { isWithinEditor } = useEditorComponent();
    const { resolveFileSrc } = useFileResolver();
    const imageRef = useRef<HTMLDivElement>(null);

    const resolvedSrc = resolveFileSrc(src);
    const finalSrc = resolvedSrc?.src || src || "";

    const isImageZoomDisabled = useIsImageZoomDisabled({
        noZoom: isImageZoomDisabledProp,
        enableZoom: isImageZoomEnabledOverride
    });

    const imageContent = (
        <div ref={imageRef} className="relative w-full">
            {isWithinEditor && <EditorComponentPopoverButton className="absolute -right-[38px] z-10" />}

            {!src || src.trim() === "" ? (
                // Placeholder when no src is provided
                <div className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-500 p-3">
                    <div className="tiptap-image-upload-text flex items-center gap-2">
                        <CloudArrowUpIcon className="size-8" />
                        <p>Add image</p>
                    </div>
                </div>
            ) : (
                // Render image when src is provided
                (() => {
                    const fernImage = (
                        <FernImage
                            ref={ref}
                            src={finalSrc}
                            width={toPixelValue(width)}
                            height={toPixelValue(height)}
                            {...rest}
                            style={{ ...style, ...__assigned_imageSize }}
                            alt={alt || ""}
                            title={title || undefined}
                            className={cn("mx-auto", className)}
                        />
                    );

                    if (isImageZoomDisabled || isWithinEditor) {
                        return fernImage;
                    }

                    return (
                        <Zoom zoomImg={{ src: finalSrc }} classDialog="custom-backdrop" wrapElement="span">
                            {fernImage}
                        </Zoom>
                    );
                })()
            )}
        </div>
    );

    if (isWithinEditor) {
        return (
            <EditorComponentPopoverProvider
                attributes={{
                    src: new TextInputControl({
                        placeholder: "Enter image URL",
                        defaultValue: src
                    }),
                    alt: new TextInputControl({
                        placeholder: "Enter alt text for accessibility",
                        defaultValue: alt
                    }),
                    title: new TextInputControl({
                        placeholder: "Enter title (tooltip text)",
                        defaultValue: title
                    }),
                    noZoom: new CheckboxControl({
                        label: "Disable zoom",
                        defaultValue: isImageZoomDisabledProp
                    })
                }}
                targetRef={imageRef}
                hoverSlopThreshold={42}
            >
                {imageContent}
            </EditorComponentPopoverProvider>
        );
    }

    // For non-editor mode, return the original logic but with resolved src
    if (!src) {
        return null;
    }

    const fernImage = (
        <FernImage
            ref={ref}
            src={finalSrc}
            width={toPixelValue(width)}
            height={toPixelValue(height)}
            {...rest}
            style={{ ...style, ...__assigned_imageSize }}
            alt={alt || ""}
            title={title || undefined}
            className={cn("mx-auto", className)}
        />
    );

    if (isImageZoomDisabled) {
        return fernImage;
    }

    return (
        <Zoom zoomImg={{ src: finalSrc }} classDialog="custom-backdrop" wrapElement="span">
            {fernImage}
        </Zoom>
    );
});

Image.displayName = "Image";

/**
 * @param element - React element
 * @returns true if the element is an `Image` component
 */
export function isImageElement(element: ReactElement<any>): element is ReactElement<ComponentProps<typeof Image>> {
    return element.type === Image;
}

/**
 * There are multiple ways to disable (or enable) image zoom:
 * - feature flag (set in the edge config) will disable image zoom globally, which can be overridden with `enableZoom`
 * - frontmatter can set `no-image-zoom` to true, which will disable image zoom for that page, and specific images can be overridden with `enableZoom`
 * - if layout is set to `custom`, by default the `no-image-zoom` frontmatter is interpreted as `true` but can be overridden as `no-image-zoom: false`
 * - otherwise, if `noZoom` is true, image zoom is disabled, false otherwise
 *
 * @param opts - Options
 * @returns true if image zoom is disabled
 */
function useIsImageZoomDisabled({ noZoom, enableZoom }: { noZoom: boolean; enableZoom: boolean }) {
    const isImageZoomDisabledContext = useContext(NoZoomContext);

    const { "no-image-zoom": isImageZoomDisabledFrontmatter, layout } = useFrontmatter();

    const isImageZoomDisabledLayout = isImageZoomDisabledFrontmatter ?? layout === "custom";

    return isImageZoomDisabledContext || isImageZoomDisabledLayout ? !enableZoom : noZoom;
}
