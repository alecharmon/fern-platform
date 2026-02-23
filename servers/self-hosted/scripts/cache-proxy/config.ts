/**
 * Configuration constants for the cache proxy, loaded from environment variables.
 */

// Server ports
export const PROXY_PORT = parseInt(process.env.CACHE_PROXY_PORT || "3000", 10);
export const BACKEND_PORT = parseInt(process.env.NEXTJS_PORT || "3001", 10);
export const BACKEND_HOST = process.env.NEXTJS_HOST || "127.0.0.1";

// Cache sizing
export const MAX_CACHE_SIZE = parseInt(process.env.CACHE_MAX_ENTRIES || "3000", 10);
export const MAX_CACHE_ENTRY_SIZE = parseInt(process.env.CACHE_MAX_ENTRY_SIZE || "5242880", 10); // 5MB default
export const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || "2592000", 10); // 30 days default
export const CACHE_DISABLED = process.env.CACHE_DISABLED === "1" || process.env.CACHE_DISABLED === "true";

// CDN TTL for downstream caches (e.g., CloudFront) - 1 hour default
export const CDN_TTL = parseInt(process.env.CACHE_CDN_TTL || "3600", 10);

// Debug logging
export const DEBUG = process.env.CACHE_PROXY_DEBUG === "1";

// Docs site domain for CORS proxy validation (e.g., "docs.example.com")
// Uses NEXT_PUBLIC_DOCS_DOMAIN_URL which is already set by run.sh from the docs.yml config
export const DOCS_DOMAIN = process.env.NEXT_PUBLIC_DOCS_DOMAIN_URL || "";

// Additional allowed domains for CORS proxy (comma-separated list of root domains)
// Example: "api.example.com,partner.example.org" allows *.example.com and *.example.org
export const ADDITIONAL_ALLOWED_DOMAINS: string[] = process.env.CORS_PROXY_ALLOWED_DOMAINS
    ? process.env.CORS_PROXY_ALLOWED_DOMAINS.split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean)
    : [];

// Test login configuration - enables a mock login endpoint for testing basic_token_verification
export const TEST_LOGIN_ENABLED =
    process.env.FERN_AUTH_TEST_LOGIN === "1" || process.env.FERN_AUTH_TEST_LOGIN === "true";
export const FERN_AUTH_SECRET = process.env.FERN_AUTH_SECRET || "";
export const FERN_AUTH_ISSUER = process.env.FERN_AUTH_ISSUER || "https://buildwithfern.com";
export const API_KEY_INJECTION_ENABLED =
    process.env.FERN_API_KEY_INJECTION_ENABLED === "true" || process.env.FERN_API_KEY_INJECTION_ENABLED === "1";

// Auth configuration for cache key generation
export const FERN_AUTH_TYPE = process.env.FERN_AUTH_TYPE || "";
export const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "";
export const OAUTH_JWT_SECRET = process.env.OAUTH_JWT_SECRET || "";
export const EVERYONE_ROLE = "everyone";

// Random token for /__cache/* admin endpoints, generated fresh each startup.
// Written to ADMIN_TOKEN_PATH so scripts running inside the container can read it.
export const CACHE_ADMIN_TOKEN = crypto.randomUUID();
export const ADMIN_TOKEN_PATH = "/tmp/.cache-admin-token";

// Base path for self-hosted docs (e.g., "/docs")
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Backend origin URL for proxying requests
export const BACKEND_ORIGIN = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

// Paths that should never be cached
// These patterns are checked using includes() for flexibility
export const EXCLUDED_PATHS = ["/_search/", "/_next/static/", "/_next/image", "/api/fern-docs/", "/_files/"];

// Paths that should be excluded unless they match an exception
export const EXCLUDED_PATHS_WITH_EXCEPTIONS: { pattern: string; exceptions: string[] }[] = [];
