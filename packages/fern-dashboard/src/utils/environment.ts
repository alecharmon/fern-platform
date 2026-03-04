export const isProduction = (): boolean => {
    return process.env.NODE_ENV === "production";
};

/**
 * Returns true only for actual Vercel production deployments.
 * Unlike isProduction(), this excludes Vercel preview deployments
 * where NODE_ENV is also "production".
 */
export const isProductionDeployment = (): boolean => {
    if (process.env.NODE_ENV !== "production") {
        return false;
    }
    // VERCEL_ENV is available server-side; NEXT_PUBLIC_VERCEL_ENV is inlined client-side via DefinePlugin
    const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
    if (vercelEnv && vercelEnv !== "production") {
        return false;
    }
    return true;
};
