"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { injectCustomStyles, type StyleOptions } from "./injectStyles";

interface TemplatePreviewProps {
    templateId: string;
    primaryColor: string | null;
    headingsFont: string;
    bodyFont: string;
    codeFont: string;
    logoUrl?: string | null;
    companyName?: string | null;
    className?: string;
}

export function TemplatePreview({
    templateId,
    primaryColor,
    headingsFont,
    bodyFont,
    codeFont,
    logoUrl,
    companyName,
    className
}: TemplatePreviewProps) {
    const [baseHtml, setBaseHtml] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [opacity, setOpacity] = useState(1);
    const [iframeKey, setIframeKey] = useState(0);

    // Track values that should trigger a fade transition (visual changes)
    const visualValues = `${logoUrl || ""}-${headingsFont}-${bodyFont}-${codeFont}-${primaryColor || ""}`;
    const prevVisualValuesRef = useRef(visualValues);

    // Fade transition only for visual changes (not text replacements which are instant)
    useEffect(() => {
        if (prevVisualValuesRef.current !== visualValues) {
            setOpacity(0);
            const timer = setTimeout(() => {
                setIframeKey((k) => k + 1);
                prevVisualValuesRef.current = visualValues;
                setTimeout(() => setOpacity(1), 50);
            }, 150);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [visualValues]);

    // Force iframe refresh when company name changes (text replacement needs remount)
    const prevCompanyNameRef = useRef(companyName);
    useEffect(() => {
        if (prevCompanyNameRef.current !== companyName) {
            prevCompanyNameRef.current = companyName;
            setIframeKey((k) => k + 1);
        }
    }, [companyName]);

    // Fetch the template HTML when template changes
    const fetchTemplate = useCallback(async (template: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/template-preview?template=${template}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch template: ${response.statusText}`);
            }

            const html = await response.text();
            setBaseHtml(html);
        } catch (err) {
            console.error("Error fetching template:", err);
            setError(err instanceof Error ? err.message : "Failed to load template preview");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplate(templateId);
    }, [templateId, fetchTemplate]);

    // Compute the final HTML with injected styles
    const processedHtml = useMemo(() => {
        if (!baseHtml) {
            return null;
        }

        const styleOptions: StyleOptions = {
            primaryColor,
            headingsFont,
            bodyFont,
            codeFont,
            logoUrl,
            companyName
        };

        return injectCustomStyles(baseHtml, styleOptions);
    }, [baseHtml, primaryColor, headingsFont, bodyFont, codeFont, logoUrl, companyName]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}>
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-green-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Loading preview...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}>
                <div className="flex flex-col items-center gap-2 text-center">
                    <span className="text-red-500">Failed to load preview</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{error}</span>
                    <button
                        onClick={() => fetchTemplate(templateId)}
                        className="mt-2 rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!processedHtml) {
        return null;
    }

    return (
        <iframe
            key={iframeKey}
            srcDoc={processedHtml}
            className={`${className} pointer-events-none`}
            style={{
                opacity,
                transition: "opacity 150ms ease-in-out"
            }}
            title="Template preview"
            sandbox="allow-scripts allow-same-origin"
        />
    );
}
