"use server";

import { type NextRequest, NextResponse } from "next/server";

import { fernCliConfig } from "@/utils/fernCliConfig";

const TEMPLATE_URLS: Record<string, string> = {
    classic: `https://docs-templates-classic.${fernCliConfig.docsDomain}`,
    minimal: `https://docs-templates-minimal.${fernCliConfig.docsDomain}`,
    products: `https://docs-templates-products.${fernCliConfig.docsDomain}`
};

/**
 * Rewrites relative URLs in HTML to absolute URLs.
 * This is necessary because the HTML will be rendered via srcdoc,
 * which doesn't have a base URL context.
 */
function rewriteUrls(html: string, baseUrl: string): string {
    // Add <base> tag to handle relative URLs for links and resources
    // This is the most reliable way to handle all relative URLs
    const baseTag = `<base href="${baseUrl}/">`;

    // Insert base tag after <head>
    if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}`);
    } else if (html.includes("<HEAD>")) {
        html = html.replace("<HEAD>", `<HEAD>${baseTag}`);
    } else {
        // If no head tag, add one
        html = html.replace(/<html[^>]*>/i, (match) => `${match}<head>${baseTag}</head>`);
    }

    return html;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const template = searchParams.get("template");

        if (!template || !TEMPLATE_URLS[template]) {
            return NextResponse.json(
                { error: "Invalid template. Must be one of: classic, minimal, products" },
                { status: 400 }
            );
        }

        const baseUrl = TEMPLATE_URLS[template];

        // Fetch the template HTML
        const response = await fetch(baseUrl, {
            headers: {
                "User-Agent": "Fern-Dashboard-Preview/1.0"
            }
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch template: ${response.statusText}` },
                { status: response.status }
            );
        }

        const html = await response.text();

        // Rewrite URLs to be absolute
        const processedHtml = rewriteUrls(html, baseUrl);

        // Return as HTML with appropriate headers
        return new NextResponse(processedHtml, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                // Cache for 5 minutes to reduce load on template sites
                "Cache-Control": "public, max-age=300, stale-while-revalidate=600"
            }
        });
    } catch (error) {
        console.error("Error in template-preview route:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
