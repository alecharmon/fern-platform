"use client";

import { useRouter } from "@bprogress/next/app";
import { ChevronDown, Clock, Plus } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import type { Auth0Organization, Auth0OrgID, Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { SearchableDropdown, type SearchableDropdownRef } from "@/components/ui/SearchableDropdown";
import { WrapWithKeyboardShortcut } from "@/components/ui/WrapWithKeyboardShortcut";
import { useOrganizations } from "@/state/useOrganizations";
import { getOrgDisplayName } from "@/utils/getOrgDisplayName";
import orgRedirect from "@/utils/orgRedirect";
import { addRecentOrg, getRecentOrgs } from "@/utils/recentOrgs";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { usePathnameWithoutOrgName } from "@/utils/usePathnameWithoutOrgName";
import { cn } from "@/utils/utils";
import { OrgLogo } from "./org-logo/OrgLogo";

interface OrgSwitcherClientRef {
    openSwitcher: () => void;
}

type OrgDropdownItem = Auth0Organization & { __isAdmin?: boolean };

const OrgSwitcherClientInternal = forwardRef<
    OrgSwitcherClientRef,
    {
        organizations: OrgDropdownItem[];
        currentOrgName?: Auth0OrgName;
        isFernAdmin: boolean;
        accessToken: string;
        userId: string;
    }
>(({ organizations, currentOrgName, isFernAdmin, accessToken, userId }, ref) => {
    const dropdownRef = useRef<SearchableDropdownRef>(null);

    useImperativeHandle(ref, () => ({
        openSwitcher: () => {
            dropdownRef.current?.open();
        }
    }));
    const orgName = useOrgNameFromPathname();
    const [localOrgName, setLocalOrgName] = useState(currentOrgName);
    const [searchTerm, setSearchTerm] = useState("");
    const [recentOrgNames, setRecentOrgNames] = useState<Auth0OrgName[]>([]);
    const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);

    useEffect(() => {
        setLocalOrgName(orgName);
        // Reset switching state when org changes (switch completed)
        setIsSwitchingOrg(false);
    }, [orgName]);

    // Load recent orgs from localStorage on mount
    useEffect(() => {
        setRecentOrgNames(getRecentOrgs(userId));
    }, [userId]);

    const pathname = usePathnameWithoutOrgName();
    const router = useRouter();

    const recentOrgIndex = useMemo(() => {
        return new Map(recentOrgNames.map((name, index) => [name, index]));
    }, [recentOrgNames]);

    const normalizedSearch = useMemo(() => {
        const trimmed = searchTerm.trim();
        return {
            trimmed,
            lower: trimmed.toLowerCase()
        };
    }, [searchTerm]);

    // Organize organizations: recent first, then the rest
    const organizedOrganizations = useMemo<OrgDropdownItem[]>(() => {
        const recentOrgs: OrgDropdownItem[] = [];
        const otherOrgs: OrgDropdownItem[] = [];

        for (const org of organizations) {
            if (recentOrgIndex.has(org.name)) {
                recentOrgs.push(org);
            } else {
                otherOrgs.push(org);
            }
        }

        // Sort recent orgs by their order in recentOrgNames
        recentOrgs.sort((a, b) => {
            return (recentOrgIndex.get(a.name) ?? 0) - (recentOrgIndex.get(b.name) ?? 0);
        });

        return [...recentOrgs, ...otherOrgs];
    }, [organizations, recentOrgIndex]);

    // Filter organizations by search term and add admin option if applicable
    const filteredOrganizationsWithAdmin = useMemo<OrgDropdownItem[]>(() => {
        const filtered = organizedOrganizations.filter((org) => {
            const displayName = getOrgDisplayName(org) ?? "";
            return displayName.toLowerCase().includes(normalizedSearch.lower);
        });

        // If user is Fern admin, has a search term, and the search doesn't match any org name exactly, add admin option
        if (isFernAdmin && normalizedSearch.trimmed.length > 0) {
            const hasExactMatch = filtered.some((org) => org.name.toLowerCase() === normalizedSearch.lower);
            if (!hasExactMatch) {
                // Create a pseudo-organization for the admin option
                const adminOption = {
                    id: `__admin_${normalizedSearch.trimmed}` as Auth0OrgID,
                    name: normalizedSearch.trimmed as Auth0OrgName,
                    display_name: `Go to '${normalizedSearch.trimmed}' →`,
                    __isAdmin: true
                } satisfies OrgDropdownItem;

                return [...filtered, adminOption];
            }
        }

        return filtered;
    }, [organizedOrganizations, normalizedSearch, isFernAdmin]);

    const getRedirectPathForOrg = useCallback(
        (newOrgName: Auth0OrgName) => {
            return `/${newOrgName}${getRedirectPathname(pathname)}`;
        },
        [pathname]
    );

    const onSelectOrg = useCallback(
        (organization: OrgDropdownItem) => {
            // Prevent rapid org switching which can cause OAuth state conflicts
            if (isSwitchingOrg) {
                return;
            }

            if (organization.name !== orgName) {
                setLocalOrgName(organization.name);
            }
            // Save to recent orgs
            addRecentOrg(userId, organization.name);
            setRecentOrgNames(getRecentOrgs(userId));

            // Mark as switching to prevent duplicate auth flows
            setIsSwitchingOrg(true);

            if (organization.__isAdmin) {
                router.push(getRedirectPathForOrg(organization.name));
                return;
            }

            router.push(orgRedirect(organization));
        },
        [isSwitchingOrg, orgName, userId, router, getRedirectPathForOrg]
    );

    const currentOrg = organizations.find((org) => org.name === localOrgName);

    const shouldShowSearch = organizations.length > 10 || isFernAdmin;

    return (
        <>
            <SearchableDropdown
                ref={dropdownRef}
                items={filteredOrganizationsWithAdmin}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelect={(org) => onSelectOrg(org)}
                searchPlaceholder="Search organizations..."
                emptyMessage="No organizations found"
                getItemKey={(org) => org.id}
                shouldShowSearch={shouldShowSearch}
                searchRightContent={
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-[38px] w-[38px] shrink-0 p-0"
                        onClick={() => router.push("/get-started/create-org?next=/:orgId/docs")}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Create organization</span>
                    </Button>
                }
                headerContent={
                    !shouldShowSearch ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="flex w-full items-center justify-start gap-2 px-2"
                            onClick={() => router.push("/get-started/create-org?next=/:orgId/docs")}
                        >
                            <Plus className="h-4 w-4" />
                            <span>Create new org</span>
                        </Button>
                    ) : undefined
                }
                renderItem={(organization, onSelectFromDropdown, isHighlighted) => {
                    // Check if this is the admin option
                    const isAdminOption = "__isAdmin" in organization && organization.__isAdmin;

                    if (isAdminOption) {
                        return (
                            <button
                                type="button"
                                className={cn(
                                    "flex w-full cursor-pointer items-center justify-between px-3 rounded py-1.5 text-left text-sm focus:outline-none flex-wrap text-muted-foreground",
                                    isHighlighted ? "bg-gray-300" : "hover:bg-gray-300"
                                )}
                                onClick={() => {
                                    onSelectFromDropdown();
                                }}
                            >
                                <div className="flex flex-1 items-center gap-2">
                                    Go to <code className="text-wrap max-w-[170px]">{organization.name}</code>
                                </div>
                                <div className="flex-shrink-0 justify-end">→</div>
                            </button>
                        );
                    }

                    // Regular organization
                    const isRecent = recentOrgNames.includes(organization.name);
                    const isCurrent = organization.name === localOrgName;
                    return (
                        <button
                            type="button"
                            className={cn(
                                "flex w-full cursor-pointer items-center justify-between px-3 rounded py-1.5 text-left text-sm focus:outline-none",
                                searchTerm.length > 0 && isHighlighted ? "bg-gray-300" : "hover:bg-gray-300"
                            )}
                            onClick={() => {
                                if (isCurrent) {
                                    return;
                                }
                                onSelectFromDropdown();
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <OrgLogo organization={organization} />
                                {getOrgDisplayName(organization)}
                            </div>
                            {isRecent && <Clock className="h-4 w-4 text-gray-600" />}
                        </button>
                    );
                }}
            >
                <Button
                    variant="outline"
                    className="shrink-0 justify-between !pl-2 md:min-w-[200px]"
                    disabled={organizations.length === 0 || isSwitchingOrg}
                >
                    <div className="flex items-center gap-2">
                        {currentOrg && <OrgLogo organization={currentOrg} />}
                        {currentOrg ? getOrgDisplayName(currentOrg) : "Select Organization"}
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </SearchableDropdown>
        </>
    );
});

OrgSwitcherClientInternal.displayName = "OrgSwitcherClientInternal";

export const OrgSwitcherClient = ({
    organizations: initialOrganizations,
    currentOrgName,
    isFernAdmin,
    accessToken,
    userId
}: {
    organizations: Auth0Organization[];
    currentOrgName?: Auth0OrgName;
    isFernAdmin: boolean;
    accessToken: string;
    userId: string;
}) => {
    const orgSwitcherRef = useRef<OrgSwitcherClientRef>(null);

    // Use client-side organizations data if available, otherwise fall back to server-provided initial data
    const organizationsResult = useOrganizations();
    const organizations = organizationsResult.type === "loaded" ? organizationsResult.value : initialOrganizations;

    return (
        <WrapWithKeyboardShortcut
            shortcut="o"
            onShortcut={() => orgSwitcherRef.current?.openSwitcher()}
            disabled={organizations.length === 0}
        >
            <OrgSwitcherClientInternal
                ref={orgSwitcherRef}
                organizations={organizations}
                currentOrgName={currentOrgName}
                isFernAdmin={isFernAdmin}
                accessToken={accessToken}
                userId={userId}
            />
        </WrapWithKeyboardShortcut>
    );
};

function getRedirectPathname(pathname: string) {
    if (!pathname || pathname === "/" || pathname.includes("get-started") || pathname.includes("/docs")) {
        return "/docs";
    }
    return pathname;
}
