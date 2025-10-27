"use client";

import * as React from "react";

import * as RechartsPrimitive from "recharts";

import { cn } from "@/utils/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = Record<
    string,
    {
        label?: React.ReactNode;
        icon?: React.ComponentType;
    } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> })
>;

interface ChartContextProps {
    config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
    const context = React.useContext(ChartContext);

    if (!context) {
        throw new Error("useChart must be used within a <ChartContainer />");
    }

    return context;
}

function ChartContainer({
    id,
    className,
    children,
    config,
    ...props
}: React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-slot="chart"
                data-chart={chartId}
                className={cn(
                    "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden flex h-full w-full justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-sector[stroke='#fff']]:stroke-transparent",
                    className
                )}
                {...props}
            >
                <ChartStyle id={chartId} config={config} />
                <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
                    {children}
                </RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
    const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color);

    if (!colorConfig.length) {
        return null;
    }

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: Object.entries(THEMES)
                    .map(
                        ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
    .map(([key, itemConfig]) => {
        const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
        return color ? `  --color-${key}: ${color};` : null;
    })
    .join("\n")}
}
`
                    )
                    .join("\n")
            }}
        />
    );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
    name,
    active,
    payload,
    className,
    indicator = "dot",
    hideLabel = false,
    label,
    labelFormatter,
    labelClassName,
    labelKey
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
        name: string;
        hideLabel?: boolean;
        hideIndicator?: boolean;
        indicator?: "line" | "dot" | "dashed";
        nameKey?: string;
        labelKey?: string;
    }) {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
        if (hideLabel || !payload?.length) {
            return null;
        }

        const [item] = payload;
        const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);
        const value = !labelKey && typeof label === "string" ? config[label]?.label || label : itemConfig?.label;

        if (labelFormatter) {
            return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>;
        }

        if (!value) {
            return null;
        }

        return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) {
        return null;
    }

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
        <div
            className={cn(
                "shadow-card-grayscale z-50 max-w-xs rounded-lg border-none bg-[var(--gray-1200)] p-2 text-center text-sm leading-normal text-[var(--gray-100)]",
                className
            )}
        >
            {!nestLabel ? tooltipLabel : null}
            <div className="flex justify-between gap-2 text-sm">
                <span className="mr-2 font-semibold">{label}</span>
                <span className="font-mono">
                    {payload[0]?.value} {name}
                </span>
            </div>
        </div>
    );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
    className,
    hideIcon = false,
    payload,
    verticalAlign = "bottom",
    nameKey
}: React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
        hideIcon?: boolean;
        nameKey?: string;
    }) {
    const { config } = useChart();

    if (!payload?.length) {
        return null;
    }

    return (
        <div
            className={cn(
                "flex items-center justify-center gap-4",
                verticalAlign === "top" ? "pb-3" : "pt-3",
                className
            )}
        >
            {payload.map((item) => {
                const key = `${nameKey || item.dataKey || "value"}`;
                const itemConfig = getPayloadConfigFromPayload(config, item, key);

                return (
                    <div
                        key={item.value}
                        className={cn(
                            "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
                        )}
                    >
                        {itemConfig?.icon && !hideIcon ? (
                            <itemConfig.icon />
                        ) : (
                            <div
                                className="h-2 w-2 shrink-0 rounded-[2px]"
                                style={{
                                    backgroundColor: item.color
                                }}
                            />
                        )}
                        {itemConfig?.label}
                    </div>
                );
            })}
        </div>
    );
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
    if (typeof payload !== "object" || payload == null) {
        return undefined;
    }

    const payloadPayload =
        "payload" in payload && typeof payload.payload === "object" && payload.payload != null
            ? payload.payload
            : undefined;

    let configLabelKey: string = key;

    if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
        configLabelKey = payload[key as keyof typeof payload] as string;
    } else if (
        payloadPayload &&
        key in payloadPayload &&
        typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
    ) {
        configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
    }

    return configLabelKey in config ? config[configLabelKey] : config[key];
}

export { ChartContainer, ChartLegend, ChartLegendContent, ChartStyle, ChartTooltip, ChartTooltipContent };
