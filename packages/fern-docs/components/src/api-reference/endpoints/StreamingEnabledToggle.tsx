import { t } from "@fern-docs/i18n";
import { Layers2, Radio } from "lucide-react";
import { type FC, type PropsWithChildren, useCallback, useMemo } from "react";
import type { FernDropdown } from "../../FernDropdown";
import { FernSegmentedControl } from "../../FernSegmentedControl";

export declare namespace StreamingEnabledToggle {
    export interface Props {
        value: boolean;
        setValue: (enabled: boolean) => void;
        className?: string;
        lang: string;
    }
}

export const StreamingEnabledToggle: FC<PropsWithChildren<StreamingEnabledToggle.Props>> = ({
    value,
    setValue,
    className,
    lang
}) => {
    const OPTIONS: FernDropdown.Option[] = useMemo(
        () => [
            { type: "value", value: "batch", label: t(lang).streamTypes.batch, icon: <Layers2 /> },
            {
                type: "value",
                value: "stream",
                label: t(lang).streamTypes.stream,
                icon: <Radio />
            }
        ],
        [lang]
    );

    return (
        <FernSegmentedControl
            options={OPTIONS}
            onValueChange={useCallback((value) => setValue(value === "stream"), [setValue])}
            value={value ? "stream" : "batch"}
            className={className}
        />
    );
};
