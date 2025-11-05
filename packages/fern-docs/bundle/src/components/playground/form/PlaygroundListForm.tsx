"use client";

import type { TypeDefinition, TypeShapeOrReference } from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";
import { Plus, X } from "lucide-react";
import { memo, useCallback } from "react";
import { getEmptyValueForType, shouldRenderInline } from "../utils";
import { PlaygroundTypeReferenceForm } from "./PlaygroundTypeReferenceForm";

interface PlaygroundListFormProps {
    itemShape: TypeShapeOrReference;
    onChange: (value: unknown) => void;
    value: unknown;
    id: string;
    types: Record<string, TypeDefinition>;
    lang: string;
}

export const PlaygroundListForm = memo<PlaygroundListFormProps>(({ itemShape, onChange, value, id, types, lang }) => {
    const appendItem = useCallback(() => {
        onChange((oldValue: unknown) => {
            const oldArray = Array.isArray(oldValue) ? oldValue : [];
            return [...oldArray, getEmptyValueForType(itemShape, types)];
        });
    }, [itemShape, onChange, types]);
    const valueAsList = Array.isArray(value) ? value : [];
    const handleChangeItem = useCallback(
        (idx: number, newValue: unknown) => {
            onChange((oldValue: unknown) => {
                const oldArray = Array.isArray(oldValue) ? oldValue : [];
                return [
                    ...oldArray.slice(0, idx),
                    typeof newValue === "function" ? newValue(oldArray[idx]) : newValue,
                    ...oldArray.slice(idx + 1)
                ];
            });
        },
        [onChange]
    );
    const handleRemoveItem = useCallback(
        (idx: number) => {
            onChange((oldValue: unknown) => {
                const oldArray = Array.isArray(oldValue) ? oldValue : [];
                return [...oldArray.slice(0, idx), ...oldArray.slice(idx + 1)];
            });
        },
        [onChange]
    );

    const renderInline = shouldRenderInline(itemShape, types);
    return (
        <>
            {valueAsList.length > 0 && (
                <ul className="border-border-default divide-border-default w-full max-w-full list-none divide-y divide-dashed border-t border-dashed">
                    {valueAsList.map((item, idx) => (
                        <PlaygroundListItemForm
                            key={idx}
                            id={id}
                            idx={idx}
                            renderInline={renderInline}
                            itemShape={itemShape}
                            item={item}
                            onChange={handleChangeItem}
                            types={types}
                            onRemove={handleRemoveItem}
                            lang={lang}
                        />
                    ))}
                    <li className="pt-2">
                        <FernButton
                            icon={<Plus />}
                            text={t(lang).buttons.addNewItem}
                            onClick={appendItem}
                            variant="outlined"
                            className="w-full"
                        />
                    </li>
                </ul>
            )}
            {valueAsList.length === 0 && (
                <FernButton
                    icon={<Plus />}
                    text={t(lang).buttons.addNewItem}
                    className="w-full"
                    onClick={appendItem}
                    variant="outlined"
                />
            )}
        </>
    );
});

interface PlaygroundListItemFormProps {
    id: string;
    idx: number;
    renderInline: boolean;
    itemShape: TypeShapeOrReference;
    item: unknown;
    onChange: (idx: number, newValue: unknown) => void;
    types: Record<string, TypeDefinition>;
    onRemove: (idx: number) => void;
    lang: string;
}

function PlaygroundListItemForm({
    id,
    idx,
    renderInline,
    itemShape,
    item,
    onChange,
    types,
    onRemove,
    lang
}: PlaygroundListItemFormProps) {
    const handleChangeItem = useCallback(
        (newItem: unknown) =>
            onChange(idx, (prev: unknown) => (typeof newItem === "function" ? newItem(prev) : newItem)),
        [onChange, idx]
    );

    return (
        <li
            key={idx}
            className={cn("min-h-12 w-full space-y-2", {
                "py-2": renderInline,
                "pb-4 pt-2": !renderInline
            })}
        >
            <div className="flex min-w-0 shrink items-center justify-between gap-2">
                <label className="inline-flex flex-wrap items-baseline">
                    <span className="text-(color:--grayscale-a11) bg-(color:--grayscale-a3) rounded-3 min-w-6 p-1 text-center text-xs font-semibold uppercase">
                        {idx + 1}
                    </span>
                </label>

                {renderInline && (
                    <PlaygroundTypeReferenceForm
                        shape={itemShape}
                        value={item}
                        onChange={handleChangeItem}
                        renderAsPanel={true}
                        id={`${id}[${idx}]`}
                        types={types}
                        lang={lang}
                    />
                )}

                <FernButton
                    icon={<X />}
                    onClick={() => onRemove(idx)}
                    variant="minimal"
                    size="small"
                    className="-ml-1 -mr-3 opacity-50 transition-opacity hover:opacity-100"
                />
            </div>

            {!renderInline && (
                <PlaygroundTypeReferenceForm
                    shape={itemShape}
                    value={item}
                    onChange={handleChangeItem}
                    renderAsPanel={true}
                    id={`${id}[${idx}]`}
                    types={types}
                    lang={lang}
                />
            )}
        </li>
    );
}

PlaygroundListForm.displayName = "PlaygroundListForm";
