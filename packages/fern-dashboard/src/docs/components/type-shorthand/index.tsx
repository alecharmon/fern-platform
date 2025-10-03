import { ReactNode } from "react";

import { uniq } from "es-toolkit/array";

import { PrimitiveType, TypeDefinition, TypeShapeOrReference, unwrapReference } from "@fern-api/fdr-sdk/api-definition";
import { unknownToString, visitDiscriminatedUnion } from "@fern-api/ui-core-utils";

import { NullableDropdown } from "./NullableDropdown";

export interface TypeShorthandRootOptions {
    shape: TypeShapeOrReference;
    types: Record<string, TypeDefinition>;
    isResponse?: boolean;
    hideOptional?: boolean;
    // Used to hide all optional, nullable, and required modifiers
    hideAllModifiers?: boolean;
    isNullable?: boolean;
    onChange?: (value: unknown) => void;
}

export interface TypeShorthandOptions {
    plural?: boolean;
    withArticle?: boolean;
    nullable?: boolean; // determines whether to render "Optional" or "Nullable"
    hideAllModifiers?: boolean;
}

export function renderTypeShorthandRoot({
    shape,
    types,
    isResponse = false,
    hideOptional = false,
    hideAllModifiers = false,
    isNullable = false,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onChange = () => {}
}: TypeShorthandRootOptions): ReactNode {
    const unwrapped = unwrapReference(shape, types);
    const typeShorthand = renderTypeShorthand(
        unwrapped.shape,
        { nullable: unwrapped.isNullable, hideAllModifiers },
        types
    );

    const nullableDropdownOptions = isNullable && !hideAllModifiers ? typeShorthand.split(" or ") : [];

    const nullableDropdown =
        nullableDropdownOptions.length > 0 ? (
            <NullableDropdown options={nullableDropdownOptions} onChange={onChange} />
        ) : null;

    return (
        <span className="fern-api-property-meta">
            <span>
                {!isResponse && nullableDropdown != null ? nullableDropdown : typeShorthand}
                {isResponse && unwrapped.isOptional && !unwrapped.isNullable && !hideAllModifiers ? " or null" : false}
            </span>
            {isResponse || hideAllModifiers ? (
                false
            ) : !unwrapped.isOptional ? (
                <span className="text-(color:--red-a11)">Required</span>
            ) : hideOptional ? (
                false
            ) : (
                <span>Optional</span>
            )}
            {unwrapped.shape.type === "primitive" &&
                toPrimitiveTypeLabels({ primitive: unwrapped.shape.value }).map((label, index) => (
                    <code key={index}>{label}</code>
                ))}
            {unwrapped.default != null && !hideAllModifiers && (
                <span>
                    {"Defaults to "}
                    <code>{unknownToString(unwrapped.default)}</code>
                </span>
            )}
        </span>
    );
}

function toPrimitiveTypeLabels({ primitive }: { primitive: PrimitiveType }): string[] {
    switch (primitive.type) {
        case "integer":
        case "long":
        case "double":
            return toPrimitiveTypeLabelsNumeric(primitive, primitive.type === "double");
        case "string":
            return toPrimitiveTypeLabelsString(primitive);
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
    regex
}: {
    format: string | undefined;
    minLength: number | undefined;
    maxLength: number | undefined;
    regex: string | undefined;
}): string[] {
    const labels = [];

    if (format != null || regex != null) {
        labels.push(`format: "${format ?? regex}"`);
    }

    if (minLength != null && maxLength != null && minLength === maxLength) {
        labels.push(`=${numberToString(minLength)} character${minLength === 1 ? "" : "s"}`);
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

export function renderTypeShorthand(
    shape: TypeShapeOrReference,
    { plural = false, withArticle = false, nullable = false, hideAllModifiers = false }: TypeShorthandOptions = {
        plural: false,
        withArticle: false,
        nullable: false,
        hideAllModifiers: false
    },
    types: Record<string, TypeDefinition>
): string {
    const unwrapped = unwrapReference(shape, types);

    const maybeWithArticle = (article: string, stringWithoutArticle: string) =>
        withArticle ? `${article} ${stringWithoutArticle}` : stringWithoutArticle;

    if (!hideAllModifiers) {
        if (unwrapped.isNullable && unwrapped.isOptional) {
            return `${maybeWithArticle("a", "nullable or optional")} ${renderTypeShorthand(unwrapped.shape, { plural, hideAllModifiers }, types)}`;
        } else if (unwrapped.isNullable) {
            return `${maybeWithArticle("a", "nullable")} ${renderTypeShorthand(unwrapped.shape, { plural, hideAllModifiers }, types)}`;
        } else if (unwrapped.isOptional) {
            return `${maybeWithArticle("an", "optional")} ${renderTypeShorthand(unwrapped.shape, { plural, hideAllModifiers }, types)}`;
        }
    }

    return (
        visitDiscriminatedUnion(unwrapped.shape)._visit({
            // primitives
            primitive: (primitive) =>
                visitDiscriminatedUnion(primitive.value, "type")._visit({
                    string: () => (plural ? "strings" : maybeWithArticle("a", "string")),
                    integer: () => (plural ? "integers" : maybeWithArticle("an", "integer")),
                    uint: () => (plural ? "uints" : maybeWithArticle("a", "uint")),
                    uint64: () => (plural ? "uint64s" : maybeWithArticle("a", "uint64")),
                    double: () => (plural ? "doubles" : maybeWithArticle("a", "double")),
                    long: () => (plural ? "longs" : maybeWithArticle("a", "long")),
                    boolean: () => (plural ? "booleans" : maybeWithArticle("a", "boolean")),
                    datetime: () => (plural ? "datetimes" : maybeWithArticle("a", "datetime")),
                    uuid: () => (plural ? "UUIDs" : maybeWithArticle("a", "UUID")),
                    base64: () => (plural ? "Base64 strings" : maybeWithArticle("a", "Base64 string")),
                    date: () => (plural ? "dates" : maybeWithArticle("a", "date")),
                    bigInteger: () => (plural ? "big integers" : maybeWithArticle("a", "big integer")),
                    _other: () => "<unknown>"
                }),

            // referenced shapes
            object: () => (plural ? "objects" : maybeWithArticle("an", "object")),
            undiscriminatedUnion: (union) => {
                return uniq(
                    union.variants.map((variant) =>
                        renderTypeShorthand(
                            variant.shape,
                            {
                                plural,
                                withArticle,
                                hideAllModifiers
                            },
                            types
                        )
                    )
                ).join(" or ");
            },
            discriminatedUnion: () => (plural ? "objects" : maybeWithArticle("an", "object")),
            enum: () => {
                return plural ? "enums" : maybeWithArticle("an", "enum");
            },

            // containing shapes
            list: (list) =>
                `${plural ? "lists of" : maybeWithArticle("a", "list of")} ${renderTypeShorthand(
                    list.itemShape,
                    { plural: true, hideAllModifiers },
                    types
                )}`,
            set: (set) =>
                `${plural ? "sets of" : maybeWithArticle("a", "set of")} ${renderTypeShorthand(
                    set.itemShape,
                    { plural: true, hideAllModifiers },
                    types
                )}`,
            map: (map) =>
                `${plural ? "maps from" : maybeWithArticle("a", "map from")} ${renderTypeShorthand(
                    map.keyShape,
                    { plural: true, hideAllModifiers },
                    types
                )} to ${renderTypeShorthand(map.valueShape, { plural: true, hideAllModifiers }, types)}`,

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
