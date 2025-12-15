import {
    type ObjectProperty,
    type TypeDefinition,
    unwrapReference,
    type WithAvailability,
    type WithDescription
} from "@fern-api/fdr-sdk/api-definition";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernTooltip } from "@fern-docs/components/FernTooltip";
import { renderTypeShorthandRoot } from "@fern-docs/components/type-shorthand";
import { HelpCircle, X } from "lucide-react";
import type { FC, PropsWithChildren, ReactNode } from "react";
import { Markdown } from "@/mdx/components/Markdown";
import { shouldRenderInline } from "./utils";

interface WithLabelProps {
    htmlFor?: string;
    property?: ObjectProperty;
    value: unknown;
    onChange: (value: unknown) => void;
    onRemove: () => void;
    types: Record<string, TypeDefinition>;
    isNullSelected: boolean;
    lang: string;
}

export const WithLabel: FC<PropsWithChildren<WithLabelProps>> = ({
    htmlFor,
    property,
    value,
    onChange,
    onRemove,
    children,
    types,
    isNullSelected,
    lang
}) => {
    if (!property) {
        return <>{children}</>;
    }
    const unwrapped = unwrapReference(property.valueShape, types);
    const renderInline = shouldRenderInline(unwrapped.shape, types);

    return (
        <WithLabelInternal
            propertyKey={property.key}
            htmlFor={htmlFor}
            value={value}
            onChange={onChange}
            onRemove={onRemove}
            availability={property.availability}
            description={property.description}
            renderInline={renderInline}
            isRequired={!unwrapped.isOptional}
            isList={unwrapped.shape.type === "list"}
            isBoolean={unwrapped.shape.type === "primitive" && unwrapped.shape.value.type === "boolean"}
            typeShorthand={renderTypeShorthandRoot({
                shape: property.valueShape,
                types,
                isResponse: false,
                hideOptional: true,
                isNullable: unwrapped.isNullable,
                onChange,
                lang
            })}
            isNullSelected={isNullSelected}
        >
            {children}
        </WithLabelInternal>
    );
};

interface WithLabelInternalProps extends WithAvailability, WithDescription {
    propertyKey: string;
    htmlFor?: string;
    value: unknown;
    onChange: (value: unknown) => void;
    onRemove: () => void;
    renderInline?: boolean;
    isRequired: boolean;
    typeShorthand: ReactNode;
    isList?: boolean;
    isBoolean?: boolean;
    isNullSelected?: boolean;
}

export const WithLabelInternal: FC<PropsWithChildren<WithLabelInternalProps>> = ({
    propertyKey,
    htmlFor,
    value,
    onRemove,
    children,
    availability,
    description,
    renderInline = false,
    isRequired,
    isList,
    isBoolean,
    typeShorthand,
    isNullSelected
}) => {
    return (
        <div
            className={cn("fern-playground-field", {
                "fern-playground-field-inline flex gap-2 max-sm:flex-col": renderInline,
                "fern-playground-field-block space-y-2": !renderInline
            })}
        >
            <div className="fern-playground-field-header flex min-w-0 flex-1 shrink items-center justify-between gap-2">
                <label
                    className="fern-playground-field-label inline-flex items-baseline gap-2 truncate"
                    htmlFor={htmlFor}
                >
                    <span className="fern-playground-field-key font-mono text-sm">{propertyKey}</span>

                    {description != null && (
                        <FernTooltip
                            // todo: server-side render this
                            content={<Markdown mdx={description} size="xs" engine="esbuild" fallback={description} />}
                            delayDuration={0}
                        >
                            <HelpCircle className="fern-playground-field-help-icon text-(color:--grayscale-a11) size-4 self-center" />
                        </FernTooltip>
                    )}

                    {availability != null && <AvailabilityBadge availability={availability} />}
                    <span className="fern-playground-field-type whitespace-nowrap text-xs">
                        <span className="text-(color:--grayscale-a11)">{typeShorthand}</span>
                    </span>

                    {isList && Array.isArray(value) && value.length > 0 && (
                        <span className="fern-playground-field-count text-(color:--grayscale-a11) whitespace-nowrap text-xs">
                            ({value.length} {value.length === 1 ? "item" : "items"})
                        </span>
                    )}
                </label>

                {!renderInline && (
                    <span className="fern-playground-field-actions inline-flex min-w-0 shrink items-center justify-end gap-1">
                        {!isRequired && (
                            <FernButton
                                icon={<X />}
                                size="small"
                                variant="minimal"
                                className="fern-playground-field-remove -mr-3 opacity-50 transition-opacity hover:opacity-100"
                                onClick={onRemove}
                            />
                        )}
                    </span>
                )}
            </div>

            <div
                className={cn("fern-playground-field-control flex", {
                    "min-w-0 flex-1 shrink": !isBoolean
                })}
            >
                {children}

                {renderInline && (
                    <span
                        className={cn(
                            "fern-playground-field-actions inline-flex min-w-0 shrink items-center justify-end gap-1",
                            isNullSelected && "w-full"
                        )}
                    >
                        {!isRequired && (
                            <FernButton
                                icon={<X />}
                                size="small"
                                variant="minimal"
                                className="fern-playground-field-remove -mr-3 ml-1 opacity-50 transition-opacity hover:opacity-100"
                                onClick={onRemove}
                            />
                        )}
                    </span>
                )}
            </div>
        </div>
    );
};
