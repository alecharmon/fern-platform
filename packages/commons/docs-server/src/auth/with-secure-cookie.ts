import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/**
 * normalizes a domain for cookie setting, handling various conventions:
 * - dot prefix for cross-subdomain sharing
 * - preserve localhost and fern-hosted sites
 */
export function normalizeDomainForCookie(hostname: string): string {
  // leave as-is for localhost or fern-hosted site
  if (hostname === "localhost" || hostname.endsWith("buildwithfern.com")) {
    return hostname;
  }

  // leave as-is for IP addresses
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split(".");

  // if it's a TLD-only domain (e.g., "com"), return as-is
  if (parts.length === 1) {
    return hostname;
  }

  // handle country-specific TLDs (e.g., .co.uk, .com.au, .co.jp, etc.)
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join(".");

    // common country TLD patterns
    const countryTLDs = [
      "co.uk",
      "com.au",
      "co.jp",
      "co.za",
      "co.nz",
      "co.in",
      "co.il",
      "co.kr",
      "com.br",
      "com.mx",
      "com.sg",
      "com.hk",
      "com.tw",
      "com.my",
      "com.ph",
      "org.uk",
      "net.uk",
      "gov.uk",
      "ac.uk",
      "edu.au",
      "gov.au",
      "net.au",
      "org.au",
      "edu.sg",
      "gov.sg",
      "org.sg",
      "net.sg",
    ];

    if (countryTLDs.includes(lastTwo)) {
      // preserve domain + TLD (e.g., example.co.uk)
      const rootDomain = parts.slice(-3).join(".");
      return `.${rootDomain}`;
    }
  }

  // otherwise, assume the root is made of the last two subdomains
  if (parts.length >= 2) {
    const rootDomain = parts.slice(-2).join(".");
    return `.${rootDomain}`;
  }

  // fallback for domains with unexpected parts
  return hostname;
}

/**
 *
 * @param targetUrl contains the host where the cookie will be set to (i.e. http://localhost:3000, https://xyz.vercel.app, https://x.docs.buildwithfern.com)
 * @param opts additional options for the cookie
 * @returns a new cookie with the secure, httpOnly set to true, and sameSite set to lax
 */
export function withSecureCookie(
  targetUrl: string,
  opts?: Partial<ResponseCookie>,
  domain?: string
): Partial<ResponseCookie> {
  const url = new URL(targetUrl);

  return {
    maxAge: 60 * 60 * 24 * 400, // 400 days (the maximum allowed by Chrome) — can be overridden by the caller
    path: "/",
    sameSite: "lax" as const,
    ...opts,
    secure: url.protocol === "https:",
    httpOnly: true,
    domain: domain ? domain : url.hostname,
  };
}

export function withDeleteCookie(
  name: string,
  targetUrl: string,
  domain: string
): Omit<ResponseCookie, "value" | "expires"> {
  const url = new URL(targetUrl);
  return {
    name,
    path: "/",
    sameSite: "lax" as const,
    secure: url.protocol === "https:",
    httpOnly: true,
    domain: domain,
  };
}
