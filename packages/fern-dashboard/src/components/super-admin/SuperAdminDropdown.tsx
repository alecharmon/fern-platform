"use client";

import { PopoverArrow } from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import {
    ChevronDown,
    ChevronRight,
    CreditCard,
    ExternalLink,
    Flag,
    Loader2,
    Search,
    Shield,
    ShieldAlert,
    Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { getSuperAdminData, type SuperAdminData } from "@/app/actions/getSuperAdminData";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

// ---------------------------------------------------------------------------
// Section Component — extensible building block
// ---------------------------------------------------------------------------

interface SuperAdminSectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function SuperAdminSection({ title, icon, children, defaultOpen = false }: SuperAdminSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-border border-b last:border-b-0">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="text-foreground hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors"
            >
                {icon}
                <span className="flex-1">{title}</span>
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {isOpen && <div className="px-3 pb-3">{children}</div>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Feature Flags Section
// ---------------------------------------------------------------------------

function FeatureFlagsSection({ flags }: { flags: Record<string, boolean | string> }) {
    const entries = Object.entries(flags).sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
        return <div className="text-muted-foreground text-xs">No feature flags found.</div>;
    }

    return (
        <div className="flex flex-col gap-1">
            {entries.map(([key, value]) => {
                const isBoolean = typeof value === "boolean";
                const isEnabled = Boolean(value);

                return (
                    <div key={key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground min-w-0 truncate font-mono" title={key}>
                            {key}
                        </span>
                        <span
                            className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
                                isBoolean
                                    ? isEnabled
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                            }`}
                        >
                            {isBoolean ? (isEnabled ? "ON" : "OFF") : String(value)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Billing & Entitlements Section
// ---------------------------------------------------------------------------

function BillingSection({ data }: { data: SuperAdminData }) {
    const { billing, entitlements } = data;

    return (
        <div className="flex flex-col gap-2">
            {/* Plan Info */}
            <div className="flex flex-col gap-1">
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Plan</div>
                <div className="text-foreground text-sm">
                    {billing.plan ? (
                        <>
                            <span className="font-medium">{billing.plan.tier}</span>
                            <span className="text-muted-foreground"> — {billing.plan.status}</span>
                            {billing.plan.planSku && (
                                <span className="text-muted-foreground ml-1 font-mono text-xs">
                                    ({billing.plan.planSku})
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-muted-foreground">No active plan (Hobby/Free)</span>
                    )}
                </div>
            </div>

            {/* Stripe Link */}
            {billing.stripeCustomerUrl && (
                <a
                    href={billing.stripeCustomerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
                >
                    <CreditCard className="h-3 w-3" />
                    View in Stripe
                    <ExternalLink className="h-3 w-3" />
                </a>
            )}
            {billing.stripeCustomerId && (
                <div className="text-muted-foreground font-mono text-xs">{billing.stripeCustomerId}</div>
            )}

            {/* Subscription Info */}
            {billing.plan?.subscription && (
                <div className="text-muted-foreground text-xs">
                    Subscription ID: <span className="font-mono">{billing.plan.subscription.id}</span>
                </div>
            )}

            {/* Products */}
            {billing.plan && billing.plan.products.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Products</div>
                    {billing.plan.products.map(
                        (product: { sku: string; kind: string; tier: string; status: string; qty: number }) => (
                            <div
                                key={product.sku}
                                className="text-muted-foreground flex items-center justify-between text-xs"
                            >
                                <span className="font-mono">{product.sku}</span>
                                <span>
                                    {product.kind} · {product.tier} · qty:{product.qty}
                                </span>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Entitlements */}
            {entitlements.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="text-muted-foreground mt-1 text-xs font-medium uppercase tracking-wide">
                        Entitlements
                    </div>
                    {entitlements.map(({ key, result }) => (
                        <div key={key} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground font-mono">{key}</span>
                            <span
                                className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
                                    result.entitled
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                                }`}
                            >
                                {result.entitled
                                    ? result.type === "boolean"
                                        ? "YES"
                                        : result.type === "quantity"
                                          ? `${result.used}/${result.limit}`
                                          : `${result.used}/${result.allowance}`
                                    : "NO"}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Auth0 Section
// ---------------------------------------------------------------------------

function Auth0Section({ auth0Org }: { auth0Org: SuperAdminData["auth0Org"] }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="text-foreground text-sm">
                <span className="text-muted-foreground text-xs">Org Name: </span>
                <span className="font-mono text-xs">{auth0Org.orgName}</span>
            </div>
            {auth0Org.displayName && (
                <div className="text-foreground text-sm">
                    <span className="text-muted-foreground text-xs">Display Name: </span>
                    <span className="text-xs">{auth0Org.displayName}</span>
                </div>
            )}
            <div className="text-foreground text-sm">
                <span className="text-muted-foreground text-xs">Org ID: </span>
                <span className="font-mono text-xs">{auth0Org.orgId}</span>
            </div>
            <a
                href={auth0Org.auth0ManageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
            >
                <Users className="h-3 w-3" />
                View in Auth0
                <ExternalLink className="h-3 w-3" />
            </a>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Org Search Section
// ---------------------------------------------------------------------------

function OrgSearchSection() {
    const router = useRouter();
    const [searchValue, setSearchValue] = useState("");

    const handleNavigate = () => {
        const trimmed = searchValue.trim();
        if (trimmed.length > 0) {
            router.push(`/${trimmed}`);
            setSearchValue("");
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Input
                placeholder="Enter org name..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        handleNavigate();
                    }
                }}
                className="h-7 text-xs"
            />
            <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={handleNavigate}
                disabled={searchValue.trim().length === 0}
            >
                Go
            </Button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Dropdown
// ---------------------------------------------------------------------------

export declare namespace SuperAdminDropdown {
    export interface Props {
        isSuperUser: boolean;
        featureFlags: Record<string, boolean | string>;
    }
}

export function SuperAdminDropdown({ isSuperUser, featureFlags }: SuperAdminDropdown.Props) {
    const orgName = useOrgNameFromPathname();
    const [hasOpened, setHasOpened] = useState(false);

    const fetchData = useCallback(async () => {
        const result = await getSuperAdminData({
            orgName: orgName as Auth0OrgName
        });
        if ("error" in result) {
            throw new Error(result.error);
        }
        return result;
    }, [orgName]);

    const { data, isLoading, error } = useQuery<SuperAdminData>({
        queryKey: ["super-admin-data", orgName],
        queryFn: fetchData,
        enabled: isSuperUser && hasOpened,
        staleTime: 60 * 1000
    });

    if (!isSuperUser) {
        return null;
    }

    return (
        <Popover
            onOpenChange={(open) => {
                if (open) {
                    setHasOpened(true);
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 w-8 justify-center px-0 has-[>svg]:px-0"
                >
                    <ShieldAlert className="h-[1.2rem] w-[1.2rem]" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" collisionPadding={8} className="w-[400px] max-h-[80vh] overflow-y-auto p-0">
                <PopoverArrow className="fill-popover" />

                {/* Header */}
                <div className="border-border flex items-center gap-2 border-b px-3 py-2">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-semibold">Super Admin Panel</span>
                    <span className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 rounded px-1.5 py-0.5 text-xs font-medium">
                        Internal
                    </span>
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="px-3 py-4 text-sm text-red-600 dark:text-red-400">Error: {error.message}</div>
                )}

                <SuperAdminSection title="Switch Org" icon={<Search className="h-4 w-4" />}>
                    <OrgSearchSection />
                </SuperAdminSection>

                <SuperAdminSection title="Feature Flags" icon={<Flag className="h-4 w-4" />}>
                    <FeatureFlagsSection flags={featureFlags} />
                </SuperAdminSection>

                {data && (
                    <>
                        <SuperAdminSection title="Billing & Entitlements" icon={<CreditCard className="h-4 w-4" />}>
                            <BillingSection data={data} />
                        </SuperAdminSection>

                        <SuperAdminSection title="Auth0 Organization" icon={<Users className="h-4 w-4" />}>
                            <Auth0Section auth0Org={data.auth0Org} />
                        </SuperAdminSection>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
