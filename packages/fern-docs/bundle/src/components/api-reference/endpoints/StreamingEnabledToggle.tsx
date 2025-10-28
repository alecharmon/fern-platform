import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernSegmentedControl } from "@fern-docs/components/FernSegmentedControl";
import { Layers2, Radio } from "lucide-react";
import { type FC, type PropsWithChildren, useCallback } from "react";

import { I18N } from "@/constants";

export declare namespace StreamingEnabledToggle {
    export interface Props {
        value: boolean;
        setValue: (enabled: boolean) => void;
        className?: string;
    }
}

const OPTIONS: FernDropdown.Option[] = [
    { type: "value", value: "batch", label: I18N.streamTypes.batch, icon: <Layers2 /> },
    {
        type: "value",
        value: "stream",
        label: I18N.streamTypes.stream,
        icon: <Radio />
    }
];

export const StreamingEnabledToggle: FC<PropsWithChildren<StreamingEnabledToggle.Props>> = ({
    value,
    setValue,
    className
}) => {
    return (
        <FernSegmentedControl
            options={OPTIONS}
            onValueChange={useCallback((value) => setValue(value === "stream"), [setValue])}
            value={value ? "stream" : "batch"}
            className={className}
        />
    );
};
