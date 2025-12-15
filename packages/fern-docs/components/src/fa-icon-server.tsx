/// <reference types="next" />

import React from "react";

import { FaIcon } from "./fa-icon";
import { getIconUrl, parseSvg } from "./util/fa";

async function FaIconServerInternal({
    icon,
    ...props
}: {
    icon: string;
} & React.SVGProps<SVGSVGElement>) {
    const url = getIconUrl(icon);
    const clientIcon = <FaIcon icon={icon} {...props} />;
    try {
        const res = await fetch(url, {
            cache: "force-cache",
            next: { tags: ["icon", icon] }
        });
        if (!res.ok) {
            return clientIcon;
        }

        const { props: svgProps, body } = parseSvg(await res.text());

        if (body == null) {
            return clientIcon;
        }

        delete svgProps.class;
        delete svgProps.className;
        delete svgProps.hidden;

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                {...props}
                {...svgProps}
                aria-hidden="true"
                focusable="false"
                role="img"
                style={{ overflow: "visible", ...props.style }}
                dangerouslySetInnerHTML={{ __html: body }}
            />
        );
    } catch (error) {
        console.error(`[fa-icon-server] ${JSON.stringify(error)}`);
        return clientIcon;
    }
}

export function FaIconServer(
    props: {
        icon: string;
        forceClientRender?: boolean;
    } & React.SVGProps<SVGSVGElement>
) {
    const { forceClientRender, ...svgProps } = props;

    // If explicitly rendering on client (e.g., in SidebarClientRootNode), use the client icon
    if (forceClientRender) {
        return <FaIcon {...svgProps} />;
    }

    // Otherwise, use the async server component with Suspense
    return (
        <React.Suspense fallback={<FaIcon {...svgProps} />}>
            <FaIconServerInternal {...svgProps} />
        </React.Suspense>
    );
}
