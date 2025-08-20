import { GithubPrStatus } from "@/app/services/github/types";
import { cn } from "@/utils/utils";

export type StatusBadgeType = "live" | "loading" | GithubPrStatus;

interface StatusBadgeProps {
  status: StatusBadgeType;
  showChevron?: boolean;
  onClick?: () => void;
  asButton?: boolean;
  className?: string;
  afterSlot?: React.ReactNode;
}

const statusConfig: Record<
  StatusBadgeType,
  {
    containerClass: string;
    dotColor: string;
    textColor: string;
    label: string;
  }
> = {
  live: {
    containerClass: "bg-green-300",
    dotColor: "bg-green-1100",
    textColor: "text-green-1100",
    label: "Live",
  },
  open: {
    containerClass: "bg-green-300 border border-green-1100",
    dotColor: "bg-green-1100",
    textColor: "text-green-1100",
    label: "Ready for Review",
  },
  closed: {
    containerClass: "bg-red-200 border border-red-700",
    dotColor: "bg-red-700",
    textColor: "text-red-700",
    label: "Closed",
  },
  merged: {
    containerClass: "bg-purple-300 border border-purple-800",
    dotColor: "bg-purple-900",
    textColor: "text-purple-900",
    label: "Merged",
  },
  draft: {
    containerClass: "bg-yellow-300 border border-yellow-800",
    dotColor: "bg-yellow-800",
    textColor: "text-yellow-800",
    label: "Draft",
  },
  loading: {
    containerClass: "bg-gray-300 border border-gray-500",
    dotColor: "bg-gray-900",
    textColor: "text-gray-900",
    label: "Loading",
  },
};

export function StatusBadge({
  status,
  className,
  onClick,
  afterSlot,
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5",
        config.containerClass,
        className
      )}
      onClick={onClick}
    >
      <div className={cn("size-2 rounded-full", config.dotColor)} />
      <div className={cn("mb-0.5 text-sm leading-none", config.textColor)}>
        {config.label}
      </div>
      {afterSlot}
    </div>
  );
}
