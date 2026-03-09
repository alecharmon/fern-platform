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
    Plus,
    Search,
    Shield,
    ShieldAlert,
    Users,
    X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import type { OrgBillingOverride } from "@fern-platform/billing";
import { addBillingOverrideAction, revokeBillingOverrideAction } from "@/app/actions/manageBillingOverride";
import { getSuperAdminData, type SuperAdminData } from "@/app/actions/getSuperAdminData";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function BillingSection({ data, onOverrideChanged }: { data: SuperAdminData; onOverrideChanged: () => void }) {
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
                {billing.plan?.hasOverrides && (
                    <div className="text-amber-600 dark:text-amber-400 text-xs">
                        Includes manual overrides
                    </div>
                )}
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
                        (product: { sku: string; kind: string; tier: string; status: string; qty: number; source?: string; overrideId?: string }) => (
                            <div
                                key={product.overrideId ?? product.sku}
                                className="text-muted-foreground flex items-center justify-between text-xs"
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="font-mono">{product.sku}</span>
                                    <span
                                        className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                                            product.source === "override"
                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                        }`}
                                    >
                                        {product.source === "override" ? "OVERRIDE" : "STRIPE"}
                                    </span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span>
                                        {product.kind} · {product.tier} · qty:{product.qty}
                                    </span>
                                    {product.source === "override" && product.overrideId && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (product.overrideId) {
                                                    await revokeBillingOverrideAction(product.overrideId);
                                                    onOverrideChanged();
                                                }
                                            }}
                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                            title="Revoke override"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
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

            {/* Add Override Form */}
            <AddOverrideForm
                orgId={data.auth0Org.orgId}
                availableSkus={data.availableSkus}
                onAdded={onOverrideChanged}
            />

            {/* Override History */}
            <OverrideHistorySection overrides={data.overrideHistory} />
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
// Add Override Form
// ---------------------------------------------------------------------------

function AddOverrideForm({
    orgId,
    availableSkus,
    onAdded
}: {
    orgId: string;
    availableSkus: string[];
    onAdded: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [sku, setSku] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!sku) return;
        setIsSubmitting(true);
        setError(null);

        const result = await addBillingOverrideAction({
            orgId,
            sku,
            startDate: startDate || undefined,
            endDate: endDate || null,
            notes: notes || null
        });

        setIsSubmitting(false);

        if ("error" in result) {
            setError(result.error);
            return;
        }

        setSku("");
        setStartDate("");
        setEndDate("");
        setNotes("");
        setIsOpen(false);
        onAdded();
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="text-primary hover:text-primary/80 mt-1 inline-flex items-center gap-1 text-xs font-medium"
            >
                <Plus className="h-3 w-3" />
                Add Override
            </button>
        );
    }

    return (
        <div className="border-border mt-2 flex flex-col gap-2 rounded border p-2">
            <div className="text-xs font-medium">Add Billing Override</div>

            <div className="flex flex-col gap-1">
                <Label className="text-xs">SKU</Label>
                <Select value={sku} onValueChange={setSku}>
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select SKU..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableSkus.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs font-mono">
                                {s}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-7 text-xs"
                    />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs">End Date</Label>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-7 text-xs"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <Label className="text-xs">Notes</Label>
                <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Reason for override..."
                />
            </div>

            {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}

            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSubmit}
                    disabled={!sku || isSubmitting}
                >
                    {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Override"}
                </Button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Override History Section
// ---------------------------------------------------------------------------

function OverrideHistorySection({ overrides }: { overrides: OrgBillingOverride[] }) {
    const expiredOrRevoked = overrides.filter(
        (o) => o.revoked_at != null || (o.end_date != null && new Date(o.end_date) <= new Date())
    );

    if (expiredOrRevoked.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="text-muted-foreground mt-1 text-xs font-medium uppercase tracking-wide">
                Override History
            </div>
            {expiredOrRevoked.map((o) => (
                <div key={o.id} className="text-muted-foreground flex items-center justify-between text-xs opacity-60">
                    <span className="font-mono">{o.sku}</span>
                    <span>
                        {o.revoked_at ? "Revoked" : "Expired"} · by {o.added_by}
                    </span>
                </div>
            ))}
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

    const { data, isLoading, error, refetch } = useQuery<SuperAdminData>({
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
                            <BillingSection data={data} onOverrideChanged={() => refetch()} />
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
