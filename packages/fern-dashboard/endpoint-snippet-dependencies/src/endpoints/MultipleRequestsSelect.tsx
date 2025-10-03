import { FC, PropsWithChildren, ReactNode, forwardRef } from "react";

import * as Select from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";

import { HttpRequest } from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components";
import { FernButton, SemanticColor } from "@fern-docs/components";

export declare namespace RequestSelect {
  export interface Props {
    selectedRequest: HttpRequest;
    requests: HttpRequest[];
    setSelectedRequest: (request: HttpRequest) => void;
    getRequestId: (request: HttpRequest) => ReactNode;
  }
}

export const RequestSelect: FC<PropsWithChildren<RequestSelect.Props>> = ({
  selectedRequest,
  requests,
  setSelectedRequest,
  getRequestId,
}) => {
  const handleValueChange = (value: string) => {
    const requestIndex = Number(value);
    const request = requests[requestIndex];
    if (request != null) {
      setSelectedRequest(request);
    }
  };

  const selectedIndex = selectedRequest
    ? requests.findIndex((r) => r === selectedRequest)
    : -1;

  return (
    <Select.Root
      onValueChange={handleValueChange}
      value={selectedIndex >= 0 ? String(selectedIndex) : undefined}
    >
      <Select.Trigger asChild={true}>
        <FernButton
          rightIcon={
            <Select.Icon>
              <ChevronDown className="size-icon" />
            </Select.Icon>
          }
          variant="minimal"
          className="-ml-1 pl-1"
        >
          <Select.Value>{getRequestId(selectedRequest)}</Select.Value>
        </FernButton>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="bg-card-background ring-border-default rounded-3/2 z-50 overflow-hidden shadow-2xl ring-1 ring-inset backdrop-blur">
          <Select.ScrollUpButton className="text-(color:--accent-a11) bg-card-background flex h-8 cursor-default items-center justify-center">
            <ChevronUp className="size-icon" />
          </Select.ScrollUpButton>
          <Select.Viewport className="p-[5px]">
            <Select.Group>
              {requests.map((request, index) => (
                <FernSelectItem value={String(index)} key={index}>
                  {getRequestId(request)}
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
>(function FernSelectItem(
  { children, className, textClassName, intent = "none", ...props },
  forwardedRef
) {
  return (
    <Select.Item
      className={cn(
        "text-body data-[disabled]:text-(color:--grayscale-a10) rounded-3/4 relative flex h-8 select-none items-center pl-2 pr-4 text-sm leading-none data-[disabled]:pointer-events-none data-[highlighted]:outline-none",
        {
          "data-[highlighted]:bg-(color:--grayscale-a3)":
            intent === "none" || intent === "primary",
          "data-[highlighted]:bg-(color:--amber-a3)": intent === "warning",
          "data-[highlighted]:bg-(color:--green-a3)": intent === "success",
          "data-[highlighted]:bg-(color:--red-a3)": intent === "danger",
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
