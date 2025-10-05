import type { HttpResponse } from "@fern-api/fdr-sdk/api-definition";
import { statusCodeToIntent } from "@fern-docs/components/badges/status-code-badge";
import { cn } from "@fern-docs/components/cn";
import type { SemanticColor } from "@fern-docs/components/colors";
import { FernButton } from "@fern-docs/components/FernButton";
import * as Select from "@radix-ui/react-select";
import type { RESET } from "jotai/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type FC, forwardRef, type PropsWithChildren, type ReactNode, type SetStateAction } from "react";

export declare namespace ResponseSelect {
    export interface Props {
        selectedResponse: HttpResponse;
        responses: HttpResponse[];
        setSelectedResponse: (response: HttpResponse) => void;
        getResponseId: (response: HttpResponse) => ReactNode;
        setSelectedExampleKey: (update: typeof RESET | SetStateAction<any>) => void;
    }
}

export const ResponseSelect: FC<PropsWithChildren<ResponseSelect.Props>> = ({
    selectedResponse,
    responses,
    setSelectedResponse,
    getResponseId,
    setSelectedExampleKey
}) => {
    const handleValueChange = (value: string) => {
        const responseIndex = Number(value);
        const response = responses[responseIndex];
        if (response != null) {
            setSelectedResponse(response);
            setSelectedExampleKey((prev: any) => ({
                ...prev,
                statusCode: String(response.statusCode)
            }));
        }
    };

    const selectedIndex = selectedResponse ? responses.findIndex((r) => r === selectedResponse) : -1;

    return (
        <Select.Root onValueChange={handleValueChange} value={selectedIndex >= 0 ? String(selectedIndex) : undefined}>
            <Select.Trigger asChild={true}>
                <FernButton
                    rightIcon={
                        <Select.Icon>
                            <ChevronDown className="size-icon" />
                        </Select.Icon>
                    }
                    variant="minimal"
                    className="-ml-1 pl-1"
                    intent={selectedResponse != null ? statusCodeToIntent(String(selectedResponse.statusCode)) : "none"}
                >
                    <Select.Value>{getResponseId(selectedResponse)}</Select.Value>
                </FernButton>
            </Select.Trigger>
            <Select.Portal>
                <Select.Content className="bg-card-background ring-border-default rounded-3/2 z-50 overflow-hidden shadow-2xl ring-1 ring-inset backdrop-blur">
                    <Select.ScrollUpButton className="text-(color:--accent-a11) bg-card-background flex h-8 cursor-default items-center justify-center">
                        <ChevronUp className="size-icon" />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-[5px]">
                        <Select.Group>
                            {responses.map((response, index) => (
                                <FernSelectItem
                                    value={String(index)}
                                    key={index}
                                    intent={statusCodeToIntent(String(response.statusCode))}
                                >
                                    {getResponseId(response)}
                                </FernSelectItem>
                            ))}
                        </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="text-(color:--accent-a11) bg-card-background flex h-8 cursor-default items-center justify-center">
                        <ChevronDown className="size-icon" />
                    </Select.ScrollDownButton>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    );
};

export const FernSelectItem = forwardRef<
    HTMLDivElement,
    Select.SelectItemProps & { textClassName?: string; intent?: SemanticColor }
>(function FernSelectItem({ children, className, textClassName, intent = "none", ...props }, forwardedRef) {
    return (
        <Select.Item
            className={cn(
                "text-body data-[disabled]:text-(color:--grayscale-a10) rounded-3/4 relative flex h-8 select-none items-center pl-2 pr-4 text-sm leading-none data-[disabled]:pointer-events-none data-[highlighted]:outline-none",
                {
                    "data-[highlighted]:bg-(color:--grayscale-a3)": intent === "none" || intent === "primary",
                    "data-[highlighted]:bg-(color:--amber-a3)": intent === "warning",
                    "data-[highlighted]:bg-(color:--green-a3)": intent === "success",
                    "data-[highlighted]:bg-(color:--red-a3)": intent === "danger"
                },
                className
            )}
            {...props}
            ref={forwardedRef}
        >
            <Select.ItemText className={textClassName}>{children}</Select.ItemText>
        </Select.Item>
    );
});
