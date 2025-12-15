import { cn } from "../../cn";

import { HorizontalOverflowMask } from "../../HorizontalOverflowMask";

import { EndpointUrl } from "./EndpointUrl";

export const EndpointUrlWithOverflow: React.FC<EndpointUrl.Props & { readonly?: string[] }> = ({
    className,
    readonly,
    ...props
}) => {
    return (
        <HorizontalOverflowMask className={cn("flex min-w-0 max-w-full shrink flex-col items-start", className)}>
            <EndpointUrl {...props} className="max-w-full" readonly={readonly} />
        </HorizontalOverflowMask>
    );
};
