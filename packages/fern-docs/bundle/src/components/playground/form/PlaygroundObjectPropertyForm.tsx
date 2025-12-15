"use client";

import {
    type ObjectProperty,
    type TypeDefinition,
    type TypeId,
    type TypeReference,
    unwrapReference
} from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { renderTypeShorthandRoot } from "@fern-docs/components/type-shorthand";
import { t } from "@fern-docs/i18n";
import { useBooleanState } from "@fern-ui/react-commons";
import { PlusCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { type FC, memo, useCallback, useEffect, useMemo, useState } from "react";
import { withErrorBoundary } from "@/components/error-boundary";
import { castToRecord, getEmptyValueForType, isExpandable } from "../utils";
import { PlaygroundAdditionalProperties } from "./PlaygroundAdditionalProperties";
import { PlaygroundTypeReferenceForm } from "./PlaygroundTypeReferenceForm";

const Markdown = dynamic(() => import("@/mdx/components/Markdown").then(({ Markdown }) => Markdown));

const ADD_ALL_KEY = "__FERN_ADD_ALL__";

interface PlaygroundObjectPropertyFormProps {
    id: string;
    property: ObjectProperty;
    onChange: (key: string, value: unknown) => void;
    value: unknown;
    expandByDefault?: boolean;
    types: Record<TypeId, TypeDefinition>;
    defaultValue?: unknown;
    isReadOnly?: boolean;
    lang: string;
}

const PlaygroundObjectPropertyFormInternal: FC<PlaygroundObjectPropertyFormProps> = ({
    id,
    property,
    onChange,
    value,
    expandByDefault = true,
    types,
    isReadOnly = false,
    lang
}) => {
    const handleChange = useCallback(
        (newValue: unknown) => {
            onChange(property.key, newValue);
        },
        [onChange, property.key]
    );

    const expandable = isExpandable(property.valueShape, value, types);
    const {
        // value: expanded,
        setTrue: setExpanded
        // toggleValue: toggleExpanded,
    } = useBooleanState(!expandable || expandByDefault);

    useEffect(() => {
        if (!expandable) {
            setExpanded();
        }
    }, [expandable, setExpanded]);

    const [_isUnderStack, setIsUnderStack] = useState(false);
    const handleOpenStack = useCallback(() => setIsUnderStack(true), []);
    const handleCloseStack = useCallback(() => setIsUnderStack(false), []);

    return (
        <PlaygroundTypeReferenceForm
            id={id}
            property={property}
            shape={property.valueShape}
            onChange={handleChange}
            value={value}
            renderAsPanel={true}
            onOpenStack={handleOpenStack}
            onCloseStack={handleCloseStack}
            types={types}
            disabled={isReadOnly}
            lang={lang}
        />
    );
};

export const PlaygroundObjectPropertyForm = withErrorBoundary(PlaygroundObjectPropertyFormInternal);

interface PlaygroundObjectPropertiesFormProps {
    id: string;
    properties: readonly ObjectProperty[];
    extraProperties: TypeReference | undefined;
    onChange: (value: unknown) => void;
    value: unknown;
    defaultValue?: unknown;
    indent?: boolean;
    types: Record<string, TypeDefinition>;
    readonly?: string[];
    lang: string;
}

export const PlaygroundObjectPropertiesFormInternal = memo<PlaygroundObjectPropertiesFormProps>((props) => {
    const { id, properties, onChange, value, indent = false, types, extraProperties, readonly, lang } = props;

    const onChangeObjectProperty = useCallback(
        (key: string, newValue: unknown) => {
            onChange((oldValue: unknown) => {
                const oldObject = castToRecord(oldValue);
                if (newValue === undefined) {
                    const { [key]: _, ...restOfFields } = oldObject;
                    return restOfFields;
                } else {
                    return {
                        ...oldObject,
                        [key]: typeof newValue === "function" ? newValue(oldObject[key]) : newValue
                    };
                }
            });
        },
        [onChange]
    );

    const shownProperties = useMemo(() => {
        return properties.filter((property) =>
            shouldShowProperty(property.valueShape, types, castToRecord(value)[property.key])
        );
    }, [properties, types, value]);

    const hiddenProperties = useMemo(() => {
        return properties.filter(
            (property) => !shouldShowProperty(property.valueShape, types, castToRecord(value)[property.key])
        );
    }, [properties, types, value]);

    const hiddenPropertiesOptions = useMemo(() => {
        const options = hiddenProperties.map(
            (property): FernDropdown.Option => ({
                type: "value",
                value: property.key,
                label: property.key,
                helperText: renderTypeShorthandRoot({
                    shape: {
                        type: "optional",
                        shape: property.valueShape,
                        default: undefined
                    },
                    types,
                    isResponse: false,
                    hideOptional: true,
                    isNullable: false,
                    onChange,
                    lang
                }),
                labelClassName: "font-mono",
                tooltip:
                    property.description != null ? (
                        // todo: server-side render this
                        <Markdown size="xs" mdx={property.description} engine="esbuild" />
                    ) : undefined
            })
        );

        if (options.length > 1) {
            options.push(
                { type: "separator" },
                {
                    type: "value",
                    value: ADD_ALL_KEY,
                    label: t(lang).buttons.addAllOptionalProperties,
                    rightElement: <PlusCircle className="size-icon" />
                }
            );
        }
        return options;
    }, [hiddenProperties, types, onChange, lang]);

    const handleAddAdditionalProperties = useCallback(
        (key: string) => {
            if (key === ADD_ALL_KEY) {
                onChange((oldValue: unknown) => {
                    const oldObject = castToRecord(oldValue);
                    return hiddenProperties.reduce((acc, property) => {
                        const newValue = getEmptyValueForType(unwrapReference(property.valueShape, types).shape, types);
                        return { ...acc, [property.key]: newValue };
                    }, oldObject);
                });
                return;
            }

            const property = hiddenProperties.find((p) => p.key === key);
            if (!property) {
                return;
            }
            onChangeObjectProperty(
                property.key,
                getEmptyValueForType(unwrapReference(property.valueShape, types).shape, types) ?? ""
            );
        },
        [hiddenProperties, onChange, onChangeObjectProperty, types]
    );

    return (
        <div
            className={cn("fern-playground-object-properties min-w-0 flex-1 shrink", {
                "border-border-default-soft border-l pl-4": indent
            })}
        >
            {shownProperties.length > 0 && (
                <ul className="fern-playground-field-list list-none space-y-8">
                    {shownProperties.map((property) => {
                        const childId = id.length > 0 ? `${id}.${property.key}` : property.key;
                        const isReadOnly = readonly?.includes(property.key) ?? false;
                        return (
                            <li
                                key={property.key}
                                className="fern-playground-field-item relative -mx-4 px-4"
                                tabIndex={-1}
                            >
                                <PlaygroundObjectPropertyForm
                                    id={childId}
                                    property={property}
                                    onChange={onChangeObjectProperty}
                                    value={castToRecord(value)[property.key]}
                                    types={types}
                                    isReadOnly={isReadOnly}
                                    lang={lang}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            {hiddenProperties.length > 0 && (
                <FernDropdown
                    options={hiddenPropertiesOptions}
                    onValueChange={handleAddAdditionalProperties}
                    lang={lang}
                >
                    <FernButton
                        text={
                            <span>
                                {`${hiddenProperties.length} ${shownProperties.length > 0 ? "more " : ""}optional propert${hiddenProperties.length > 1 ? "ies" : "y"}`}
                                <span className="text-(color:--grayscale-a11) ml-2 font-mono text-xs opacity-50">
                                    {hiddenProperties.map((property) => property.key).join(", ")}
                                </span>
                            </span>
                        }
                        variant="outlined"
                        rightIcon={<PlusCircle />}
                        className="mt-8 w-full text-left first:mt-0"
                    />
                </FernDropdown>
            )}

            {extraProperties != null && (
                <PlaygroundAdditionalProperties
                    onChange={onChange}
                    properties={properties}
                    extraProperties={extraProperties}
                    value={value}
                    types={types}
                    lang={lang}
                />
            )}
        </div>
    );
});

PlaygroundObjectPropertiesFormInternal.displayName = "PlaygroundObjectPropertiesFormInternal";

export const PlaygroundObjectPropertiesForm = withErrorBoundary(
    PlaygroundObjectPropertiesFormInternal,
    <div>Error rendering object properties form</div>
);

function shouldShowProperty(
    shape: ObjectProperty["valueShape"],
    types: Record<TypeId, TypeDefinition>,
    value: unknown
): boolean {
    const unwrapped = unwrapReference(shape, types);
    return !unwrapped.isOptional || value !== undefined;
}
