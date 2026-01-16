import { type ApiMethodType, GrpcMethod } from "@fern-api/docs-utils";

import { ChevronDown, ChevronUp } from "lucide-react";
import { forwardRef } from "react";

import type { UIColor } from "../colors";
import { FaIcon } from "../fa-icon";
import { Badge, type BadgeProps } from "./badge";

const METHOD_COLOR_SCHEMES: Record<ApiMethodType, UIColor> = {
    GET: "green",
    DELETE: "red",
    POST: "blue",
    PUT: "amber",
    PATCH: "orange",
    HEAD: "gray",
    OPTIONS: "bronze",
    CONNECT: "sky",
    TRACE: "purple",
    WSS: "green",
    UNARY: "gray",
    CLIENT_STREAM: "gray",
    SERVER_STREAM: "gray",
    BIDIRECTIONAL_STREAM: "gray",
    QUERY: "green",
    MUTATION: "blue",
    SUBSCRIPTION: "purple"
};

/**
 * Abbreviated method names for smaller (fixed-width) badges.
 */
const ABBREVIATED_METHODS: Record<ApiMethodType, string> = {
    GET: "GET",
    DELETE: "DEL",
    POST: "POST",
    PUT: "PUT",
    PATCH: "PATCH",
    HEAD: "HEAD",
    OPTIONS: "OPT",
    CONNECT: "CON",
    TRACE: "TRACE",
    WSS: "WSS",
    UNARY: "UNARY",
    CLIENT_STREAM: "STREAM",
    SERVER_STREAM: "STREAM",
    BIDIRECTIONAL_STREAM: "STREAM",
    QUERY: "QUERY",
    MUTATION: "MUT",
    SUBSCRIPTION: "SUB"
};

const GRPC_STREAM_ICONS: Partial<Record<ApiMethodType, string>> = {
    CLIENT_STREAM: "fa-solid fa-arrow-up",
    SERVER_STREAM: "fa-solid fa-arrow-down",
    BIDIRECTIONAL_STREAM: "fa-solid fa-arrow-up-arrow-down"
};

export interface ApiMethodBadgeProps extends Omit<BadgeProps, "color"> {
    method: ApiMethodType;
    chevronProps?: {
        show: boolean;
        isOpen: boolean;
    };
}

export const ApiMethodBadge = forwardRef<HTMLSpanElement & HTMLButtonElement, ApiMethodBadgeProps>((props, ref) => {
    const { method, chevronProps, ...rest } = props;
    const icon = GRPC_STREAM_ICONS[method];

    return (
        <Badge
            ref={ref}
            {...rest}
            data-badge-type="http-method"
            data-http-method={method}
            color={METHOD_COLOR_SCHEMES[method]}
            className={`${rest.className || ""} ${chevronProps?.show ? "inline-flex w-auto items-center gap-1" : ""}`}
        >
            {icon && <FaIcon icon={icon} className="grpc-streaming-arrow" />}
            {props.children ?? (rest.size === "sm" || method in GrpcMethod ? ABBREVIATED_METHODS[method] : method)}
            {chevronProps?.show &&
                (chevronProps.isOpen ? (
                    <ChevronUp className="size-3 flex-shrink-0" />
                ) : (
                    <ChevronDown className="size-3 flex-shrink-0" />
                ))}
        </Badge>
    );
});

ApiMethodBadge.displayName = "ApiMethodBadge";
