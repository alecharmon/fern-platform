"use client";

import { conformTrailingSlash } from "@fern-api/docs-utils";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { format, resolve, type UrlObject } from "url";

import { useCurrentPathname } from "./hooks/use-current-pathname";
import { useDomain } from "./state/domain";

/**
 * Context that tracks whether we're inside a FernLink (i.e., inside an <a> tag).
 * Used to prevent nested <a> tags, which are invalid HTML and cause the browser
 * to auto-close the outer <a> during SSR parsing, breaking the DOM structure.
 */
const FernLinkNestingCtx = React.createContext<boolean>(false);

export function useIsInsideFernLink(): boolean {
    return React.useContext(FernLinkNestingCtx);
}

export const FernLink = React.forwardRef<
    HTMLAnchorElement,
    Omit<React.ComponentProps<typeof Link>, "href"> & {
        href: string;
        showExternalLinkIcon?: boolean;
    }
>(function FernLink({ showExternalLinkIcon = false, ...props }, ref) {
    const isInsideLink = useIsInsideFernLink();
    const url = toUrlObject(props.href);
    const isExternalUrl = checkIsExternalUrl(url);

    // If we're already inside an <a> tag, render as a <span> with click navigation
    // to avoid invalid nested <a> tags that break SSR HTML parsing.
    if (isInsideLink) {
        return <FernNestedLink ref={ref} {...stripNextLinkProps(props)} url={url} isExternal={isExternalUrl} />;
    }

    // if the url is relative, we will need to invoke useRouter to resolve the relative url
    // since useRouter injects the router context, it will cause a re-render any time the route changes.
    // to avoid unnecessary re-renders, we will isolate the useRouter call to a separate component.
    if (!isExternalUrl && checkIsRelativeUrl(url)) {
        return (
            <FernLinkNestingCtx.Provider value={true}>
                <FernRelativeLink ref={ref} {...props} />
            </FernLinkNestingCtx.Provider>
        );
    }

    if (isExternalUrl) {
        return (
            <FernLinkNestingCtx.Provider value={true}>
                <FernExternalLink
                    ref={ref}
                    {...stripNextLinkProps(props)}
                    showExternalLinkIcon={showExternalLinkIcon}
                    url={url}
                />
            </FernLinkNestingCtx.Provider>
        );
    }

    return (
        <FernLinkNestingCtx.Provider value={true}>
            <Link ref={ref} {...props} href={conformTrailingSlash(props.href)} />
        </FernLinkNestingCtx.Provider>
    );
});

FernLink.displayName = "FernLink";

/**
 * Renders a non-<a> element when a link is nested inside another link.
 * Uses onClick + router.push for internal links, or window.open for external links.
 */
const FernNestedLink = React.forwardRef<
    HTMLAnchorElement,
    Omit<React.ComponentProps<"a">, "href"> & {
        href?: string;
        url: UrlObject;
        isExternal: boolean;
    }
>(({ url, isExternal, href, onClick, ...props }, ref) => {
    const router = useRouter();
    const resolvedHref = href ?? formatUrlString(url);

    const handleClick = React.useCallback(
        (e: React.MouseEvent<HTMLSpanElement>) => {
            // Allow cmd/ctrl+click to open in new tab
            if (e.metaKey || e.ctrlKey) {
                window.open(resolvedHref, "_blank");
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (isExternal) {
                window.open(resolvedHref, props.target ?? "_blank");
            } else {
                router.push(conformTrailingSlash(resolvedHref));
            }
        },
        [resolvedHref, isExternal, props.target, router]
    );

    return (
        <span
            ref={ref as React.Ref<HTMLSpanElement>}
            role="link"
            tabIndex={0}
            {...(props as React.ComponentProps<"span">)}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(e as unknown as React.MouseEvent<HTMLSpanElement>);
                }
            }}
            style={{ cursor: "pointer", ...props.style }}
        />
    );
});

FernNestedLink.displayName = "FernNestedLink";

const FernRelativeLink = React.forwardRef<HTMLAnchorElement, React.ComponentProps<typeof Link>>((props, ref) => {
    const pathname = useCurrentPathname();
    const href = resolveRelativeUrl(pathname, formatUrlString(props.href));
    return <Link ref={ref} prefetch={true} {...props} href={conformTrailingSlash(href)} />;
});

FernRelativeLink.displayName = "FernRelativeLink";

interface FernExternalLinkProps extends Omit<React.ComponentProps<"a">, "href"> {
    showExternalLinkIcon: boolean;
    url: UrlObject;
}

const FernExternalLink = React.forwardRef<HTMLAnchorElement, FernExternalLinkProps>(
    ({ showExternalLinkIcon, url, ...props }, ref) => {
        const domain = useDomain();
        const [host, setHost] = React.useState<string>(domain);
        React.useEffect(() => {
            if (typeof window !== "undefined") {
                setHost(window.location.host);
            }
        }, []);

        // if the link is to a different domain, always open in a new tab
        // TODO: if the link is to the same domain, we should check if the page is a fern page, and if so, use the Link component to leverage client-side navigation
        const isSameSite = host === url.host;
        return (
            <a
                ref={ref}
                {...props}
                target={isSameSite || props.target != null ? props.target : "_blank"}
                rel={
                    isSameSite && props.target !== "_blank"
                        ? props.rel
                        : props.rel == null
                          ? "noreferrer"
                          : props.rel.includes("noreferrer")
                            ? props.rel
                            : `${props.rel} noreferrer`
                }
                href={formatUrlString(url)}
            >
                {props.children}
                {!isSameSite && showExternalLinkIcon && <ExternalLinkIcon className="external-link-icon" />}
            </a>
        );
    }
);

FernExternalLink.displayName = "FernExternalLink";

export function toUrlObject(url: string | UrlObject): UrlObject {
    if (url == null) {
        return {};
    }
    if (typeof url === "string") {
        const parsed = safeParseUrl(url);
        if (parsed) {
            return parsed;
        }
    }
    return url as UrlObject;
}

export function formatUrlString(url: string | UrlObject): string {
    if (url == null) {
        return "";
    }
    if (typeof url === "object") {
        return format(url);
    }
    return typeof url === "string" ? url : "";
}

export function resolveRelativeUrl(pathName: string, href: string): string {
    // if the href is "../" or "./" or missing an initial slash, we want to resolve it relative to the current page
    if (href.startsWith(".") || !href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) {
        const pathname = resolve(pathName, href);
        return pathname;
    }
    return href;
}

export function checkIsExternalUrl(url: UrlObject): boolean {
    return url.protocol != null && url.host != null;
}

export function checkIsRelativeUrl(url: UrlObject): boolean {
    if (url.href == null) {
        return true;
    }

    if (url.protocol) {
        return false;
    }

    // If it starts with /, it's an absolute path (not relative)
    if (url.href.startsWith("/")) {
        return false;
    }

    return (
        url.href.startsWith(".") || url.href.startsWith("#") || url.href.startsWith("?") || !url.href.startsWith("/")
    );
}

type MaybeFernLinkProps = Omit<React.ComponentPropsWithoutRef<typeof FernLink>, "href"> & {
    href?: React.ComponentPropsWithoutRef<typeof FernLink>["href"];
};

export const MaybeFernLink = React.forwardRef<HTMLAnchorElement, MaybeFernLinkProps>(function MaybeFernLink(
    { href, ...props },
    ref
) {
    if (href == null) {
        return <span ref={ref} {...stripNextLinkProps(props)} />;
    }
    return <FernLink ref={ref} {...props} href={href} />;
});

function stripNextLinkProps<T extends MaybeFernLinkProps>(
    props: T
): Omit<T, "href" | "locale" | "prefetch" | "replace" | "scroll" | "shallow"> {
    const { href, locale, prefetch, replace, scroll, shallow, ...rest } = props;
    return rest;
}

const safeParseUrl = (url: string | undefined): UrlObject | null => {
    return url
        ? (() => {
              try {
                  // check if it's an absolute URL (has protocol)
                  // this includes both http://example.com and mailto:email@example.com
                  if (url.includes("://") || /^[a-zA-Z]+:/.test(url)) {
                      const urlObj = new URL(url);
                      // for non-http protocols like mailto:, tel:, etc., don't set slashes to true
                      // as they don't use the standard URL format with slashes
                      const isStandardProtocol = urlObj.protocol === "http:" || urlObj.protocol === "https:";
                      return {
                          protocol: urlObj.protocol,
                          slashes: isStandardProtocol,
                          auth: "",
                          host: urlObj.host,
                          port: urlObj.port,
                          hostname: urlObj.hostname,
                          hash: urlObj.hash,
                          search: urlObj.search,
                          query: urlObj.search,
                          pathname: urlObj.pathname,
                          path: urlObj.pathname + urlObj.search,
                          href: urlObj.href
                      };
                  } else {
                      // handle relative URLs by parsing with a base URL
                      // then extracting only the relative parts
                      const urlObj = new URL(url, "http://localhost");
                      return {
                          protocol: null,
                          slashes: null,
                          auth: null,
                          host: null,
                          port: null,
                          hostname: null,
                          hash: urlObj.hash,
                          search: urlObj.search,
                          query: urlObj.search,
                          pathname: urlObj.pathname,
                          path: urlObj.pathname + urlObj.search,
                          href: url
                      };
                  }
              } catch (_error) {
                  return null;
              }
          })()
        : null;
};
