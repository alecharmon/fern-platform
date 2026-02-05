import { getClient } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";

import { type BillingError, billingError } from "../errors";
import type { BillingProduct, OrgActiveProduct } from "./types";

/**
 * Get all active billing products.
 */
export async function getActiveProducts(): Promise<Result<BillingProduct[], BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client.from("billing_product").select("*").eq("is_active", true);

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get products: ${error.message}`, error));
        }

        return ok(data ?? []);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get products", e));
    }
}

/**
 * Get billing product by SKU.
 */
export async function getProductBySku(sku: string): Promise<Result<BillingProduct | null, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client.from("billing_product").select("*").eq("sku", sku).maybeSingle();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get product: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get product", e));
    }
}

/**
 * Get billing product by ID.
 */
export async function getProductById(id: string): Promise<Result<BillingProduct | null, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client.from("billing_product").select("*").eq("id", id).maybeSingle();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get product: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get product", e));
    }
}

/**
 * Get active products for an org using the org_active_products view.
 */
export async function getOrgActiveProducts(orgId: string): Promise<Result<OrgActiveProduct[], BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client.from("org_active_products").select("*").eq("org_id", orgId);

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get org products: ${error.message}`, error));
        }

        return ok(data ?? []);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get org products", e));
    }
}
