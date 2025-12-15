"use client";

import { useQuery } from "@tanstack/react-query";
import { GlobeIcon } from "lucide-react";

import { getDocsSiteDomains } from "@/app/actions/getDocsSiteDomains";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface SelectDomainProps {
    docsUrl: string;
    orgName: Auth0OrgName;
    value: string | null;
    onChange: (value: string | null) => void;
    className?: string;
}

export default function SelectDomain({ docsUrl, orgName, value, onChange, className }: SelectDomainProps) {
    const {
        data: domains,
        isLoading,
        error
    } = useQuery({
        queryKey: ["docs-site-domains", docsUrl, orgName],
        queryFn: () => getDocsSiteDomains(docsUrl, orgName),
        staleTime: 1000 * 60 * 10 // 10 minutes
    });

    // Show loading skeleton
    if (isLoading) {
        return <Skeleton className="h-9 w-40" />;
    }

    // Log errors but don't show component if error
    if (error) {
        console.error("Failed to load domains for selector:", error);
        return null;
    }

    // Don't show if no domains or only one domain
    if (!domains || domains.length <= 1) {
        return null;
    }

    const handleValueChange = (selectedValue: string) => {
        if (selectedValue === "all") {
            onChange(null);
        } else {
            onChange(selectedValue);
        }
    };

    const displayValue = value || "All domains";

    return (
        <Select onValueChange={handleValueChange} value={value || "all"}>
            <SelectTrigger
                className={`border-border gap-2 bg-white px-3 py-1.5 text-sm dark:bg-transparent ${className || ""}`}
            >
                <GlobeIcon className="text-muted-foreground size-4" />
                <SelectValue placeholder={displayValue}>{displayValue}</SelectValue>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                {domains.map((domainUrl) => {
                    const domain = domainUrl.domain + (domainUrl.path || "");
                    return (
                        <SelectItem key={domain} value={domainUrl.domain}>
                            {domain}
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}
