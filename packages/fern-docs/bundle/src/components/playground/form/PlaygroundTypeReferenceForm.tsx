"use client";

import {
    type ObjectProperty,
    type TypeDefinition,
    type TypeShapeOrReference,
    unwrapObjectType,
    unwrapReference
} from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { cn } from "@fern-docs/components/cn";
import { FernDatetimeInput } from "@fern-docs/components/FernDatetimeInput";
import { FernInput } from "@fern-docs/components/FernInput";
import { FernNumericInput } from "@fern-docs/components/FernNumericInput";
import { FernSwitch } from "@fern-docs/components/FernSwitch";
import { FernTextarea } from "@fern-docs/components/FernTextarea";
import { t } from "@fern-docs/i18n";
import { memo, type ReactElement, useCallback, useState } from "react";

import { withErrorBoundary } from "@/components/error-boundary";

import { IdempotentInputGroup } from "../IdempotentInputGroup";
import { PasswordInputGroup } from "../PasswordInputGroup";
import { WithLabel } from "../WithLabel";
import { PlaygroundDiscriminatedUnionForm } from "./PlaygroundDescriminatedUnionForm";
import { PlaygroundEnumForm } from "./PlaygroundEnumForm";
import { PlaygroundListForm } from "./PlaygroundListForm";
import { PlaygroundMapForm } from "./PlaygroundMapForm";
import { PlaygroundMicrophoneForm } from "./PlaygroundMicrophoneForm";
import { PlaygroundObjectForm } from "./PlaygroundObjectForm";
import {
    PlaygroundTypeReferenceFormContext,
    usePlaygroundTypeReferenceFormContext
} from "./PlaygroundTypeReferenceFormContext";
import { PlaygroundUniscriminatedUnionForm } from "./PlaygroundUniscriminatedUnionForm";
import { PlaygroundUnknownForm } from "./PlaygroundUnknownForm";

interface PlaygroundTypeReferenceFormProps {
    id: string;
    property?: ObjectProperty;
    shape: TypeShapeOrReference;
    onChange: (value: unknown) => void;
    value?: unknown;
    // onFocus?: () => void;
    // onBlur?: () => void;
    onOpenStack?: () => void;
    onCloseStack?: () => void;
    renderAsPanel?: boolean;
    types: Record<string, TypeDefinition>;
    disabled?: boolean;
    defaultValue?: unknown;
    indent?: boolean;
    lang: string;
}

const PlaygroundTypeReferenceFormInternal = memo<PlaygroundTypeReferenceFormProps>((props) => {
    const { id, property, shape, onChange, value, types, indent = true, defaultValue, disabled = false, lang } = props;
    const { isNullSelected } = usePlaygroundTypeReferenceFormContext();
    const onRemove = useCallback(() => {
        onChange(undefined);
    }, [onChange]);
    return visitDiscriminatedUnion(unwrapReference(shape, types).shape)._visit<ReactElement<any> | null>({
        object: (object) => {
            const { properties } = unwrapObjectType(object, types);
            const isFreeformObject = properties.length === 0;

            if (isFreeformObject) {
                return (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "hidden")}>
                            <PlaygroundUnknownForm
                                id={id}
                                onChange={onChange}
                                value={value}
                                disabled={disabled}
                                lang={lang}
                            />
                        </span>
                    </WithLabel>
                );
            }

            return (
                <WithLabel
                    property={property}
                    value={value}
                    onChange={onChange}
                    onRemove={onRemove}
                    types={types}
                    isNullSelected={isNullSelected}
                    lang={lang}
                >
                    <span className={cn("block w-full", isNullSelected && "hidden")}>
                        <PlaygroundObjectForm
                            shape={object}
                            onChange={onChange}
                            value={value}
                            indent={indent}
                            id={id}
                            types={types}
                            lang={lang}
                        />
                    </span>
                </WithLabel>
            );
        },
        enum: ({ values }) => (
            <WithLabel
                property={property}
                value={value}
                onChange={onChange}
                onRemove={onRemove}
                types={types}
                isNullSelected={isNullSelected}
                lang={lang}
            >
                <span className={cn("block w-full min-w-0", isNullSelected && "invisible")}>
                    <PlaygroundEnumForm enumValues={values} onChange={onChange} value={value} id={id} lang={lang} />
                </span>
            </WithLabel>
        ),
        undiscriminatedUnion: (undiscriminatedUnion) => (
            <WithLabel
                property={property}
                value={value}
                onChange={onChange}
                onRemove={onRemove}
                types={types}
                isNullSelected={isNullSelected}
                lang={lang}
            >
                <span className={cn("block w-full", isNullSelected && "hidden")}>
                    <PlaygroundUniscriminatedUnionForm
                        undiscriminatedUnion={undiscriminatedUnion}
                        onChange={onChange}
                        value={value}
                        id={id}
                        types={types}
                        lang={lang}
                        // TODO: add default value
                    />
                </span>
            </WithLabel>
        ),
        discriminatedUnion: (discriminatedUnion) => (
            <WithLabel
                property={property}
                value={value}
                onChange={onChange}
                onRemove={onRemove}
                types={types}
                isNullSelected={isNullSelected}
                lang={lang}
            >
                <span className={cn("block w-full", isNullSelected && "hidden")}>
                    <PlaygroundDiscriminatedUnionForm
                        discriminatedUnion={discriminatedUnion}
                        onChange={onChange}
                        value={value}
                        id={id}
                        types={types}
                        lang={lang}
                        // TODO: add default value
                    />
                </span>
            </WithLabel>
        ),
        primitive: (primitive) =>
            visitDiscriminatedUnion(primitive.value, "type")._visit<ReactElement<any> | null>({
                string: (string) => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        isNullSelected={isNullSelected}
                        htmlFor={id}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            {property?.key === "user_audio_chunk" || // TODO(naman): remove hardcoding for ElevenLabs once the backend mimeType is plumbed through
                            (primitive.value.type === "base64" &&
                                primitive.value.mimeType?.includes("audio/webm") &&
                                typeof window !== "undefined" &&
                                MediaRecorder.isTypeSupported("audio/webm")) ? (
                                <PlaygroundMicrophoneForm
                                    id={id}
                                    className="w-full"
                                    value={typeof value === "string" ? value : ""}
                                    onValueChange={onChange}
                                    onAudioData={onChange}
                                    placeholder={string.default ?? undefined}
                                    lang={lang}
                                />
                            ) : primitive.value.type === "string" && primitive.value.format === "password" ? (
                                <PasswordInputGroup
                                    id={id}
                                    className="w-full"
                                    value={typeof value === "string" ? value : ""}
                                    onValueChange={onChange}
                                    placeholder={string.default ?? undefined}
                                    resettable={typeof defaultValue === "string"}
                                    maxLength={string.maxLength ?? undefined}
                                    minLength={string.minLength ?? undefined}
                                    pattern={string.regex ?? undefined}
                                    lang={lang}
                                />
                            ) : primitive.value.type === "string" && property?.key === "idempotency_key" ? (
                                <IdempotentInputGroup
                                    id={id}
                                    className="w-full"
                                    value={typeof value === "string" ? value : ""}
                                    onValueChange={onChange}
                                    lang={lang}
                                />
                            ) : (
                                <FernInput
                                    id={id}
                                    className="w-full"
                                    value={typeof value === "string" ? value : ""}
                                    onValueChange={onChange}
                                    placeholder={string.default ?? undefined}
                                    resettable={typeof defaultValue === "string"}
                                    maxLength={string.maxLength ?? undefined}
                                    minLength={string.minLength ?? undefined}
                                    // TODO: add validation UX feedback
                                    pattern={string.regex ?? undefined}
                                    disabled={disabled}
                                    clearable={!disabled}
                                    lang={lang}
                                />
                            )}
                        </span>
                    </WithLabel>
                ),
                boolean: () => {
                    const checked = typeof value === "boolean" ? value : undefined;
                    return (
                        <WithLabel
                            property={property}
                            value={value}
                            onChange={onChange}
                            onRemove={onRemove}
                            types={types}
                            htmlFor={id}
                            isNullSelected={isNullSelected}
                            lang={lang}
                        >
                            <span className={cn("block w-full", isNullSelected && "invisible")}>
                                <div className="flex items-center justify-start gap-3">
                                    {/* <label className="text-(color:--grayscale-a11) font-mono text-sm leading-none">
                                    {checked == null ? "undefined" : checked ? "true" : "false"}
                                </label> */}
                                    <FernSwitch
                                        checked={checked}
                                        onCheckedChange={onChange}
                                        defaultChecked={typeof defaultValue === "boolean" ? defaultValue : undefined}
                                        id={id}
                                        disabled={disabled}
                                    />
                                </div>
                            </span>
                        </WithLabel>
                    );
                },
                integer: (integer) => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernNumericInput
                                id={id}
                                className="w-full"
                                value={typeof value === "number" ? value : undefined}
                                onValueChange={onChange}
                                disallowFloat={true}
                                // resettable={typeof defaultValue === "number"}
                                max={integer.maximum ?? undefined}
                                min={integer.minimum ?? undefined}
                                disabled={disabled}
                            />
                        </span>
                    </WithLabel>
                ),
                double: (double) => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernNumericInput
                                id={id}
                                className="w-full"
                                value={typeof value === "number" ? value : undefined}
                                onValueChange={onChange}
                                // resettable={typeof defaultValue === "number"}
                                max={double.maximum ?? undefined}
                                min={double.minimum ?? undefined}
                                disabled={disabled}
                            />
                        </span>
                    </WithLabel>
                ),
                long: (long) => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernNumericInput
                                id={id}
                                className="w-full"
                                value={typeof value === "number" ? value : undefined}
                                onValueChange={onChange}
                                disallowFloat={true}
                                // resettable={typeof defaultValue === "number"}
                                max={long.maximum ?? undefined}
                                min={long.minimum ?? undefined}
                                disabled={disabled}
                            />
                        </span>
                    </WithLabel>
                ),
                uint: () => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernNumericInput
                                id={id}
                                className="w-full"
                                value={typeof value === "number" ? value : undefined}
                                // resettable={typeof defaultValue === "number"}
                                onValueChange={onChange}
                                disallowFloat={true}
                                disabled={disabled}
                            />
                        </span>
                    </WithLabel>
                ),
                uint64: () => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernNumericInput
                                id={id}
                                className="w-full"
                                value={typeof value === "number" ? value : undefined}
                                // resettable={typeof defaultValue === "number"}
                                onValueChange={onChange}
                                disallowFloat={true}
                                disabled={disabled}
                            />
                        </span>
                    </WithLabel>
                ),
                datetime: () => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernDatetimeInput
                                id={id}
                                className="w-full"
                                placeholder={t(lang).dataTypes.dateTimeFormat}
                                value={typeof value === "string" ? value : undefined}
                                resettable={typeof defaultValue === "string"}
                                onValueChange={onChange}
                                disabled={disabled}
                                lang={lang}
                            />
                        </span>
                    </WithLabel>
                ),
                uuid: () => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernInput
                                id={id}
                                className="w-full"
                                value={typeof value === "string" ? value : ""}
                                resettable={typeof defaultValue === "string"}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                onValueChange={onChange}
                                disabled={disabled}
                                clearable={!disabled}
                                lang={lang}
                            />
                        </span>
                    </WithLabel>
                ),
                base64: () => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernTextarea
                                id={id}
                                className="w-full"
                                value={typeof value === "string" ? value : ""}
                                onValueChange={onChange}
                                disabled={disabled}
                            />
                        </span>
                    </WithLabel>
                ),
                date: () => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernInput
                                id={id}
                                type="date"
                                className="w-full"
                                placeholder={t(lang).dataTypes.dateFormat}
                                value={typeof value === "string" ? value : undefined}
                                resettable={typeof defaultValue === "string"}
                                onValueChange={onChange}
                                disabled={disabled}
                                clearable={!disabled}
                                lang={lang}
                            />
                        </span>
                    </WithLabel>
                ),
                bigInteger: () => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <FernTextarea
                                id={id}
                                className="w-full"
                                value={typeof value === "string" ? value : ""}
                                // resettable={typeof defaultValue === "string"}
                                onValueChange={onChange}
                                disabled={disabled}
                            />
                        </span>
                    </WithLabel>
                ),
                scalar: () => null,
                _other: () => null
            }),
        list: (list) => (
            <WithLabel
                property={property}
                value={value}
                onChange={onChange}
                onRemove={onRemove}
                types={types}
                htmlFor={id}
                isNullSelected={isNullSelected}
                lang={lang}
            >
                <span className={cn("block w-full", isNullSelected && "hidden")}>
                    <PlaygroundListForm
                        itemShape={list.itemShape}
                        onChange={onChange}
                        value={value}
                        id={id}
                        types={types}
                        lang={lang}
                        // TODO: add default value
                    />
                </span>
            </WithLabel>
        ),
        set: (set) => (
            <WithLabel
                property={property}
                value={value}
                onChange={onChange}
                onRemove={onRemove}
                types={types}
                htmlFor={id}
                isNullSelected={isNullSelected}
                lang={lang}
            >
                <span className={cn("block w-full", isNullSelected && "hidden")}>
                    <PlaygroundListForm
                        itemShape={set.itemShape}
                        onChange={onChange}
                        value={value}
                        id={id}
                        types={types}
                        lang={lang}
                        // TODO: add default value
                    />
                </span>
            </WithLabel>
        ),
        map: (map) => (
            <WithLabel
                property={property}
                value={value}
                onChange={onChange}
                onRemove={onRemove}
                types={types}
                htmlFor={id}
                isNullSelected={isNullSelected}
                lang={lang}
            >
                <span className={cn("block w-full", isNullSelected && "hidden")}>
                    <PlaygroundMapForm
                        id={id}
                        keyShape={map.keyShape}
                        valueShape={map.valueShape}
                        onChange={onChange}
                        value={value}
                        types={types}
                        lang={lang}
                        // TODO: add default value
                    />
                </span>
            </WithLabel>
        ),
        literal: (literal) =>
            visitDiscriminatedUnion(literal.value, "type")._visit({
                stringLiteral: (stringLiteral) => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <code>{stringLiteral.value}</code>
                        </span>
                    </WithLabel>
                ),
                booleanLiteral: (stringLiteral) => (
                    <WithLabel
                        property={property}
                        value={value}
                        onChange={onChange}
                        onRemove={onRemove}
                        types={types}
                        htmlFor={id}
                        isNullSelected={isNullSelected}
                        lang={lang}
                    >
                        <span className={cn("block w-full", isNullSelected && "invisible")}>
                            <code>{stringLiteral.value ? "true" : "false"}</code>
                        </span>
                    </WithLabel>
                ),
                _other: () => null
            }),
        unknown: () => (
            <WithLabel
                property={property}
                value={value}
                onChange={onChange}
                onRemove={onRemove}
                types={types}
                htmlFor={id}
                isNullSelected={isNullSelected}
                lang={lang}
            >
                <span className={cn("block w-full", isNullSelected && "hidden")}>
                    <PlaygroundUnknownForm id={id} onChange={onChange} value={value} disabled={disabled} lang={lang} />
                </span>
            </WithLabel>
        ),
        _other: () => null
    });
});

PlaygroundTypeReferenceFormInternal.displayName = "PlaygroundTypeReferenceFormInternal";

export const PlaygroundTypeReferenceFormWithContext = (props: PlaygroundTypeReferenceFormProps) => {
    const [isNullSelected, setIsNullSelected] = useState(false);

    return (
        <PlaygroundTypeReferenceFormContext.Provider value={{ isNullSelected, setIsNullSelected }}>
            <PlaygroundTypeReferenceFormInternal {...props} />
        </PlaygroundTypeReferenceFormContext.Provider>
    );
};

export const PlaygroundTypeReferenceForm = withErrorBoundary(PlaygroundTypeReferenceFormWithContext);
