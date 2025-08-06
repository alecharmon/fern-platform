/**
 * validates and sanitizes a base URL.
 * returns null if the URL cannot be coerced into a valid URL.
 */
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  // handle protocol-relative URLs (starting with //)
  if (url.startsWith("//")) {
    try {
      const parsedUrl = new URL(`https:${url}`);
      return parsedUrl.toString();
    } catch {
      return undefined;
    }
  }

  // handle URLs without protocol
  if (
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    !url.startsWith("wss://") &&
    !url.startsWith("ws://")
  ) {
    try {
      const parsedUrl = new URL(`https://${url}`);
      return parsedUrl.toString();
    } catch {
      return undefined;
    }
  }

  // validate complete URLs
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch {
    return undefined;
  }
}
