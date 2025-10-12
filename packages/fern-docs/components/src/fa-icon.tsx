"use client";

import { isEqual } from "es-toolkit/predicate";
import React from "react";
import useSWRImmutable from "swr/immutable";

import { getIconUrl, parseSvg } from "./util/fa";

export type FaIconGradient = {
    id: string;
    stops: {
        offset: string;
        color: string;
    }[];
    type?: "linear" | "radial";
    direction?: {
        x1?: string;
        y1?: string;
        x2?: string;
        y2?: string;
    };
};
export const FaIcon = React.memo(
    React.forwardRef<
        React.ComponentRef<"svg">,
        {
            icon: string;
            fallback?: React.ElementType<React.SVGProps<SVGSVGElement>>;
            gradients?: FaIconGradient[];
        } & React.SVGProps<SVGSVGElement>
    >(({ icon, fallback: Fallback = "svg", gradients, fill, ...props }, ref) => {
        const url = getIconUrl(icon);

        const { data } = useSWRImmutable(url, () =>
            fetch(url, { cache: "force-cache" }).then((res) => (res.ok ? res.text() : undefined))
        );

        if (data == null) {
            return <Fallback ref={ref} aria-hidden="true" focusable="false" role="img" {...props} />;
        }

        // parse the svg
        const { props: svgProps, body } = parseSvg(data);

        if (body == null) {
            return <Fallback ref={ref} aria-hidden="true" focusable="false" role="img" {...props} />;
        }

        delete svgProps.class;
        delete svgProps.className;
        delete svgProps.hidden;

        let htmlContent = body;

        // If gradients are provided, we need to add them to the SVG gradient definitions
        if (gradients != null && gradients.length > 0) {
            const gradientDefs = [];

            for (const gradient of gradients) {
                const gradientDef = gradient
                    ? gradient.type === "radial"
                        ? `<radialGradient id="${gradient.id}">
                ${gradient.stops.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`).join("")}
              </radialGradient>`
                        : `<linearGradient 
                id="${gradient.id}"
                x1="${gradient.direction?.x1 || "0%"}"
                y1="${gradient.direction?.y1 || "100%"}"
                x2="${gradient.direction?.x2 || "0%"}"
                y2="${gradient.direction?.y2 || "0%"}"
              >
                ${gradient.stops.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`).join("")}
              </linearGradient>`
                    : "";

                gradientDefs.push(gradientDef);
            }

            const gradientForFill = fill != null && gradients.find((g) => fill.includes(g.id));

            const modifiedBody = gradientForFill
                ? body.replace(/fill="[^"]*"/g, `fill="url(#${gradientForFill.id})"`)
                : body;

            htmlContent = `
        <defs>${gradientDefs.join("")}</defs>
        ${modifiedBody}
      `;
        }

        return (
            <svg
                ref={ref}
                xmlns="http://www.w3.org/2000/svg"
                {...props}
                {...svgProps}
                aria-hidden="true"
                focusable="false"
                role="img"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
        );
    }),
    (prevProps, nextProps) => {
        return (
            prevProps.icon === nextProps.icon &&
            prevProps.className === nextProps.className &&
            isEqual(prevProps.style, nextProps.style) &&
            prevProps.width === nextProps.width &&
            prevProps.height === nextProps.height &&
            prevProps.color === nextProps.color &&
            prevProps.fill === nextProps.fill &&
            prevProps.stroke === nextProps.stroke
        );
    }
);
