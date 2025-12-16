import { cn } from "@fern-docs/components/cn";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { unwrapChildren } from "../../common/unwrap-children";

export interface VersionsProps {
    children?: ReactNode;
    className?: string;
    /**
     * the query parameter name to use for version selection
     * @default "v"
     */
    paramName?: string;
}

export function Versions({ children, className, paramName = "v" }: VersionsProps) {
    const items = unwrapChildren(children, Version);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const versionParam = searchParams.get(paramName);

    const defaultVersion = items.find((item) => item.props.default) || items[0];
    const [activeVersion, setActiveVersion] = useState(() => {
        if (versionParam != null) {
            const matchingVersion = items.find((item) => item.props.version === versionParam);
            if (matchingVersion) {
                return versionParam;
            }
        }
        return defaultVersion?.props.version;
    });

    useEffect(() => {
        if (versionParam != null) {
            const matchingVersion = items.find((item) => item.props.version === versionParam);
            if (matchingVersion) {
                setActiveVersion(versionParam);
            }
        } else {
            setActiveVersion(defaultVersion?.props.version);
        }
    }, [versionParam, items, defaultVersion]);

    const handleVersionChange = (version: string) => {
        setActiveVersion(version);

        // Update URL with query parameter when a version is selected.
        const params = new URLSearchParams(searchParams.toString());
        params.set(paramName, version);
        const newURL = `${pathname}?${params.toString()}`;
        router.replace(newURL, { scroll: false });
    };

    const currentVersion = items.find((item) => item.props.version === activeVersion);

    return (
        <div className={cn("mb-6 mt-4 first:-mt-3", className)}>
            <div className="mb-6">
                <FernDropdown
                    value={activeVersion}
                    onValueChange={handleVersionChange}
                    options={items.map(({ props: { version, title } }) => ({
                        type: "value" as const,
                        label: title || version,
                        value: version
                    }))}
                    side="bottom"
                    align="start"
                    triggerAsChild={false}
                    lang="en"
                >
                    <div className="bg-tag-default hover:bg-tag-default/80 inline-flex h-9 items-center gap-2 rounded px-3 text-sm">
                        {currentVersion?.props.title || currentVersion?.props.version}
                        <ChevronDown className="size-icon animate-dropdown-chevron" />
                    </div>
                </FernDropdown>
            </div>
            {items.map((item) => (
                <div
                    key={item.props.version}
                    style={{ display: item.props.version === activeVersion ? "block" : "none" }}
                >
                    {item}
                </div>
            ))}
        </div>
    );
}

export interface VersionProps {
    /**
     * the version identifier (e.g., "v1.0.0", "v2.0.0") - must be unique
     */
    version: string;
    /**
     * the display title for this version
     * @default version
     */
    title?: string;
    /**
     * whether this is the default version to display
     * @default false
     */
    default?: boolean;
    /**
     * the children of the version
     */
    children?: ReactNode;
    className?: string;
}

export function Version({ children, className }: VersionProps) {
    return <div className={className}>{children}</div>;
}
