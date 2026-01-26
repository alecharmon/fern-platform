import {
    type PrimitiveType,
    type TypeDefinition,
    type TypeShapeOrReference,
    unwrapReference
} from "@fern-api/fdr-sdk/api-definition";
import { unknownToString, visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { t } from "@fern-docs/i18n";
import { uniq } from "es-toolkit/array";
import type { ReactNode } from "react";
import { NullableDropdown } from "./NullableDropdown";
import { ScalarTooltip } from "./ScalarTooltip";

export interface TypeShorthandRootOptions {
    shape: TypeShapeOrReference;
    types: Record<string, TypeDefinition>;
    isResponse?: boolean;
    hideOptional?: boolean;
    // Used to hide all optional, nullable, and required modifiers
    hideAllModifiers?: boolean;
    isNullable?: boolean;
    onChange?: (value: unknown) => void;
    lang: string;
    // When true, capitalizes first letter of types to follow GraphQL conventions
    isGraphQL?: boolean;
}

export interface TypeShorthandOptions {
    plural?: boolean;
    withArticle?: boolean;
    nullable?: boolean; // determines whether to render "Optional" or "Nullable"
    hideAllModifiers?: boolean;
    // When true, capitalizes first letter of types to follow GraphQL conventions
    isGraphQL?: boolean;
}

/**
 * Gets scalar info from the shape if it's a scalar primitive, otherwise returns undefined.
 */
function getScalarInfo(
    shape: TypeShapeOrReference,
    types: Record<string, TypeDefinition>
): { name: string; description: string | undefined } | undefined {
    const unwrapped = unwrapReference(shape, types);
    if (unwrapped.shape.type === "primitive" && unwrapped.shape.value.type === "scalar") {
        return {
            name: unwrapped.shape.value.name,
            description: unwrapped.shape.value.description
        };
    }
    return undefined;
}

/**
 * Renders the type shorthand, replacing the scalar name with a tooltip-wrapped version if it has a description.
 */
function renderTypeShorthandWithScalarTooltip(
    typeShorthand: string,
    scalarInfo: { name: string; description: string | undefined } | undefined
): ReactNode {
    if (!scalarInfo?.description) {
        return typeShorthand;
    }

    // Split the type shorthand by the scalar name and reconstruct with tooltip
    const parts = typeShorthand.split(scalarInfo.name);
    if (parts.length === 1) {
        // Scalar name not found in shorthand (shouldn't happen, but fallback)
        return typeShorthand;
    }

    return (
        <>
            {parts.map((part, index) => (
                <span key={index}>
                    {part}
                    {index < parts.length - 1 && (
                        <ScalarTooltip name={scalarInfo.name} description={scalarInfo.description} />
                    )}
                </span>
            ))}
        </>
    );
}

export function renderTypeShorthandRoot({
    shape,
    types,
    isResponse = false,
    hideOptional = false,
    hideAllModifiers = false,
    isNullable = false,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onChange = () => {},
    lang,
    isGraphQL = false
}: TypeShorthandRootOptions): ReactNode {
    const unwrapped = unwrapReference(shape, types);
    const typeShorthand = renderTypeShorthand(
        unwrapped.shape,
        { nullable: unwrapped.isNullable, hideAllModifiers, isGraphQL },
        types
    );

    const scalarInfo = getScalarInfo(shape, types);
    const typeDisplay = renderTypeShorthandWithScalarTooltip(typeShorthand, scalarInfo);

    const nullableDropdownOptions = isNullable && !hideAllModifiers ? typeShorthand.split(" or ") : [];

    const nullableDropdown =
        nullableDropdownOptions.length > 0 ? (
            <NullableDropdown options={nullableDropdownOptions} onChange={onChange} lang={lang} />
        ) : null;

    return (
        <span className="fern-api-property-meta">
            <span className="fern-api-property-type">
                {!isResponse && nullableDropdown != null ? nullableDropdown : typeDisplay}
                {isResponse && unwrapped.isOptional && !unwrapped.isNullable && !hideAllModifiers
                    ? " " + t(lang).apiReference.orNull
                    : false}
            </span>
            {isResponse || hideAllModifiers ? (
                false
            ) : !unwrapped.isOptional ? (
                <span className="fern-api-property-required text-(color:--red-a11)">
                    {t(lang).apiReference.required}
                </span>
            ) : hideOptional ? (
                false
            ) : (
                <span className="fern-api-property-optional">{t(lang).apiReference.optional}</span>
            )}
            {unwrapped.shape.type === "primitive" &&
                toPrimitiveTypeLabels({ primitive: unwrapped.shape.value, lang }).map((label, index) => (
                    <code className="fern-api-property-constraint" key={index}>
                        {label}
                    </code>
                ))}
            {unwrapped.default != null && !hideAllModifiers && (
                <span className="fern-api-property-default">
                    {t(lang).playground.defaultsTo}
                    <code>{unknownToString(unwrapped.default)}</code>
                </span>
            )}
        </span>
    );
}

function toPrimitiveTypeLabels({ primitive, lang }: { primitive: PrimitiveType; lang: string }): string[] {
    switch (primitive.type) {
        case "integer":
        case "long":
        case "double":
            return toPrimitiveTypeLabelsNumeric(primitive, primitive.type === "double");
        case "string":
            return toPrimitiveTypeLabelsString({ ...primitive, lang });
        default:
            return [];
    }
}

function numberToString(value: number, isDouble = false): string {
    return isDouble ? String(value) : String(Math.floor(value));
}

function toPrimitiveTypeLabelsNumeric(
    {
        minimum,
        maximum
    }: {
        minimum: number | undefined;
        maximum: number | undefined;
    },
    isDouble: boolean
): string[] {
    const labels = [];

    if (minimum != null && maximum != null && minimum === maximum) {
        labels.push(`=${numberToString(minimum, isDouble)}`);
    } else if (minimum != null && maximum != null) {
        labels.push(`${numberToString(minimum, isDouble)}-${numberToString(maximum, isDouble)}`);
    } else {
        if (minimum != null) {
            labels.push(`>=${numberToString(minimum, isDouble)}`);
        }

        if (maximum != null) {
            labels.push(`<=${numberToString(maximum, isDouble)}`);
        }
    }

    return labels;
}

function toPrimitiveTypeLabelsString({
    format,
    minLength,
    maxLength,
    regex,
    lang
}: {
    format: string | undefined;
    minLength: number | undefined;
    maxLength: number | undefined;
    regex: string | undefined;
    lang: string;
}): string[] {
    const labels = [];

    if (format != null || regex != null) {
        labels.push(`${t(lang).apiReference.format}: "${format ?? regex}"`);
    }

    if (minLength != null && maxLength != null && minLength === maxLength) {
        labels.push(`=${numberToString(minLength)} character${minLength === 1 ? "" : "s"}`);
    } else if (minLength != null && maxLength != null) {
        labels.push(`${numberToString(minLength)}-${numberToString(maxLength)} characters`);
    } else {
        if (minLength != null) {
            labels.push(`>=${numberToString(minLength)} character${minLength === 1 ? "" : "s"}`);
        }

        if (maxLength != null) {
            labels.push(`<=${numberToString(maxLength)} character${maxLength === 1 ? "" : "s"}`);
        }
    }

    return labels;
}

// export function renderTypeShorthandFormDataProperty(
//     property: Exclude<FormDataRequestProperty, FormDataRequestProperty.BodyProperty>,
// ): ReactNode {
//     return (
//         <span className="fern-api-property-meta">
//             <span>{property.type === "file" ? "file" : property.type === "fileArray" ? "files" : "unknown"}</span>
//             {property.isOptional ? <span>Optional</span> : <span className="text-(color:--red-a11)">Required</span>}
//         </span>
//     );
// }

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function renderTypeShorthand(
    shape: TypeShapeOrReference,
    {
        plural = false,
        withArticle = false,
        nullable = false,
        hideAllModifiers = false,
        isGraphQL = false
    }: TypeShorthandOptions = {
        plural: false,
        withArticle: false,
        nullable: false,
        hideAllModifiers: false,
        isGraphQL: false
    },
    types: Record<string, TypeDefinition>
): string {
    const unwrapped = unwrapReference(shape, types);

    const maybeWithArticle = (article: string, stringWithoutArticle: string) =>
        withArticle ? `${article} ${stringWithoutArticle}` : stringWithoutArticle;

    // Helper to apply GraphQL capitalization convention
    const formatType = (type: string): string => (isGraphQL ? capitalize(type) : type);

    if (!hideAllModifiers) {
        if (unwrapped.isNullable && unwrapped.isOptional) {
            return `${maybeWithArticle("a", "nullable or optional")} ${renderTypeShorthand(unwrapped.shape, { plural, hideAllModifiers, isGraphQL }, types)}`;
        } else if (unwrapped.isNullable) {
            return `${maybeWithArticle("a", "nullable")} ${renderTypeShorthand(unwrapped.shape, { plural, hideAllModifiers, isGraphQL }, types)}`;
        } else if (unwrapped.isOptional) {
            return `${maybeWithArticle("an", "optional")} ${renderTypeShorthand(unwrapped.shape, { plural, hideAllModifiers, isGraphQL }, types)}`;
        }
    }

    return (
        visitDiscriminatedUnion(unwrapped.shape)._visit({
            // primitives
            primitive: (primitive) =>
                visitDiscriminatedUnion(primitive.value, "type")._visit({
                    string: () => (plural ? formatType("strings") : maybeWithArticle("a", formatType("string"))),
                    integer: () => (plural ? formatType("integers") : maybeWithArticle("an", formatType("integer"))),
                    uint: () => (plural ? formatType("uints") : maybeWithArticle("a", formatType("uint"))),
                    uint64: () => (plural ? formatType("uint64s") : maybeWithArticle("a", formatType("uint64"))),
                    double: () => (plural ? formatType("doubles") : maybeWithArticle("a", formatType("double"))),
                    long: () => (plural ? formatType("longs") : maybeWithArticle("a", formatType("long"))),
                    boolean: () => (plural ? formatType("booleans") : maybeWithArticle("a", formatType("boolean"))),
                    datetime: () => (plural ? formatType("datetimes") : maybeWithArticle("a", formatType("datetime"))),
                    uuid: () => (plural ? "UUIDs" : maybeWithArticle("a", "UUID")),
                    base64: () => (plural ? "Base64 strings" : maybeWithArticle("a", "Base64 string")),
                    date: () => (plural ? formatType("dates") : maybeWithArticle("a", formatType("date"))),
                    bigInteger: () => (plural ? "big integers" : maybeWithArticle("a", "big integer")),
                    scalar: (s) => s.name,
                    _other: () => "<unknown>"
                }),

            // referenced shapes
            object: () => (plural ? formatType("objects") : maybeWithArticle("an", formatType("object"))),
            undiscriminatedUnion: (union) => {
                return uniq(
                    union.variants.map((variant) =>
                        renderTypeShorthand(
                            variant.shape,
                            {
                                plural,
                                withArticle,
                                hideAllModifiers,
                                isGraphQL
                            },
                            types
                        )
                    )
                ).join(" or ");
            },
            discriminatedUnion: () => (plural ? formatType("objects") : maybeWithArticle("an", formatType("object"))),
            enum: () => {
                return plural ? formatType("enums") : maybeWithArticle("an", formatType("enum"));
            },

            // containing shapes
            list: (list) =>
                `${plural ? "lists of" : maybeWithArticle("a", "list of")} ${renderTypeShorthand(
                    list.itemShape,
                    { plural: true, hideAllModifiers, isGraphQL },
                    types
                )}`,
            set: (set) =>
                `${plural ? "sets of" : maybeWithArticle("a", "set of")} ${renderTypeShorthand(
                    set.itemShape,
                    { plural: true, hideAllModifiers, isGraphQL },
                    types
                )}`,
            map: (map) =>
                `${plural ? "maps from" : maybeWithArticle("a", "map from")} ${renderTypeShorthand(
                    map.keyShape,
                    { plural: true, hideAllModifiers, isGraphQL },
                    types
                )} to ${renderTypeShorthand(map.valueShape, { plural: true, hideAllModifiers, isGraphQL }, types)}`,

            // literals
            literal: (literal) =>
                visitDiscriminatedUnion(literal.value, "type")._visit({
                    stringLiteral: ({ value }) => `"${value}"`,
                    booleanLiteral: ({ value }) => value.toString(),
                    _other: () => "<unknown>"
                }),
            // other
            unknown: (value) => value.displayName ?? "any",
            _other: () => "<unknown>"
        }) + (nullable ? " or null" : "")
    );
}
