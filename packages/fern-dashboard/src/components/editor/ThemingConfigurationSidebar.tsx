"use client";

import { useNavigation } from "@fern-docs/components/navigation";
import { ChevronDown, UploadCloudIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChromePicker } from "react-color";
import { Input } from "@/components/ui/input";
import { useFileResolver } from "@/providers/FileResolverContext";
import { useThemingPanel } from "@/providers/ThemingPanelProvider";
import { cn } from "@/utils/utils";
import {
    applyColorOverridesToPreviewContainer,
    COLOR_FIELDS,
    EMPTY_THEME_COLORS,
    parseColorsFromYml,
    type ThemeColors,
    updateColorsInYml
} from "./docs-yml-colors";
import {
    type DocsYmlSettings,
    EMPTY_DOCS_YML_SETTINGS,
    findDocsYmlFilePath,
    parseSettingsFromYml,
    removeFaviconFromYml,
    removeLogoFromYml,
    updateFaviconInYml,
    updateLogoInYml,
    updateTitleInYml
} from "./docs-yml-settings";

function InlineColorSwatch({
    color,
    label,
    onChange
}: {
    color: string | null;
    label: string;
    onChange: (color: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={ref}>
            <button type="button" className="flex items-center gap-1.5" onClick={() => setIsOpen(!isOpen)}>
                <div
                    className="size-6 rounded border border-gray-500"
                    style={{ backgroundColor: color ?? "transparent" }}
                />
                <span className="text-xs text-gray-900">{label}</span>
            </button>
            {isOpen && (
                <div className="absolute top-8 right-0 z-50">
                    <ChromePicker color={color ?? "#000000"} onChange={(c) => onChange(c.hex)} disableAlpha />
                </div>
            )}
        </div>
    );
}

function AccordionToggle({ label, isOpen, onToggle }: { label: string; isOpen: boolean; onToggle: () => void }) {
    return (
        <button type="button" className="flex w-full items-center gap-1.5 pb-3" onClick={onToggle}>
            <ChevronDown className={cn("size-4 text-gray-900 transition-transform", !isOpen && "-rotate-90")} />
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

function ImageUploadRow({
    previewUrl,
    onFileSelect,
    onRemove,
    description,
    accept = "image/*"
}: {
    previewUrl: string | null;
    onFileSelect: (file: File) => void;
    onRemove?: () => void;
    description: string;
    accept?: string;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
    const [removed, setRemoved] = useState(false);

    const effectivePreview = removed ? null : (localPreviewUrl ?? previewUrl);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }
        const localPreview = URL.createObjectURL(file);
        setLocalPreviewUrl(localPreview);
        setRemoved(false);
        onFileSelect(file);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemove = () => {
        setLocalPreviewUrl(null);
        setRemoved(true);
        onRemove?.();
    };

    const hasImage = effectivePreview != null;

    return (
        <div className="flex items-start gap-3">
            <div
                className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-500 bg-transparent transition-colors hover:border-gray-700"
                onClick={() => fileInputRef.current?.click()}
            >
                {effectivePreview ? (
                    // biome-ignore lint/performance/noImgElement: inline preview
                    <img src={effectivePreview} alt="preview" className="h-full w-full object-contain p-1" />
                ) : (
                    <UploadCloudIcon className="size-5 text-gray-700" />
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <input ref={fileInputRef} type="file" className="hidden" accept={accept} onChange={handleFileChange} />
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        className="flex w-fit items-center gap-1 rounded-md border border-gray-500 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gray-100"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadCloudIcon className="size-3.5" />
                        <span>Upload</span>
                    </button>
                    {hasImage && onRemove && (
                        <button
                            type="button"
                            className="flex w-fit items-center gap-1 rounded-md border border-gray-500 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                            onClick={handleRemove}
                        >
                            <XIcon className="size-3.5" />
                            <span>Remove</span>
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-900 leading-snug">{description}</p>
            </div>
        </div>
    );
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(",")[1];
            if (base64) {
                resolve(base64);
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export function ThemingConfigurationSidebar() {
    const { getDocsYmlContent, updateDocsYmlContent, addAssetFile } = useNavigation();
    const { setColorOverrides, setLogoOverrideUrl } = useThemingPanel();
    const { resolveFileSrc } = useFileResolver();
    const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(true);
    const [isFaviconOpen, setIsFaviconOpen] = useState(true);
    const [isLogoOpen, setIsLogoOpen] = useState(true);

    const docsYmlFilePath = useMemo(() => findDocsYmlFilePath(getDocsYmlContent), [getDocsYmlContent]);
    const docsYmlContent = docsYmlFilePath ? getDocsYmlContent(docsYmlFilePath) : null;

    const initialColors = useMemo(() => {
        if (!docsYmlContent) {
            return { ...EMPTY_THEME_COLORS };
        }
        return parseColorsFromYml(docsYmlContent);
    }, [docsYmlContent]);

    const initialSettings = useMemo(() => {
        if (!docsYmlContent) {
            return { ...EMPTY_DOCS_YML_SETTINGS };
        }
        return parseSettingsFromYml(docsYmlContent);
    }, [docsYmlContent]);

    const [colors, setColors] = useState<ThemeColors>(initialColors);
    const colorsRef = useRef(colors);
    colorsRef.current = colors;
    const [settings, setSettings] = useState<DocsYmlSettings>(initialSettings);

    // Resolve existing asset URLs using the file resolver (handles private repos, CDN URLs, etc.)
    const existingFaviconUrl = useMemo(() => {
        if (!settings.favicon) {
            return null;
        }
        const resolved = resolveFileSrc(settings.favicon, docsYmlFilePath ?? undefined);
        return resolved?.src ?? null;
    }, [settings.favicon, resolveFileSrc, docsYmlFilePath]);

    const existingLogoUrl = useMemo(() => {
        if (!settings.logo) {
            return null;
        }
        const resolved = resolveFileSrc(settings.logo, docsYmlFilePath ?? undefined);
        return resolved?.src ?? null;
    }, [settings.logo, resolveFileSrc, docsYmlFilePath]);

    useEffect(() => {
        setColors(initialColors);
        setColorOverrides(initialColors);
    }, [initialColors, setColorOverrides]);

    useEffect(() => {
        setSettings(initialSettings);
    }, [initialSettings]);

    const handleColorChange = useCallback(
        (key: keyof ThemeColors, variant: "dark" | "light", value: string) => {
            const updated = {
                ...colorsRef.current,
                [key]: { ...colorsRef.current[key], [variant]: value }
            };

            setColors(updated);
            setColorOverrides(updated);

            // Apply directly to the DOM for instant visual feedback.
            // This bypasses any React rendering or context propagation delays.
            applyColorOverridesToPreviewContainer(updated);

            if (docsYmlFilePath && docsYmlContent) {
                const updatedYml = updateColorsInYml(docsYmlContent, updated);
                updateDocsYmlContent(docsYmlFilePath, updatedYml);
            }
        },
        [docsYmlFilePath, docsYmlContent, updateDocsYmlContent, setColorOverrides]
    );

    const handleTitleChange = useCallback(
        (value: string) => {
            setSettings((prev) => ({ ...prev, title: value }));
            if (docsYmlFilePath && docsYmlContent) {
                const updatedYml = updateTitleInYml(docsYmlContent, value);
                updateDocsYmlContent(docsYmlFilePath, updatedYml);
            }
        },
        [docsYmlFilePath, docsYmlContent, updateDocsYmlContent]
    );

    const handleFaviconSelect = useCallback(
        (file: File) => {
            const faviconPath = file.name;
            setSettings((prev) => ({ ...prev, favicon: faviconPath }));
            if (docsYmlFilePath && docsYmlContent) {
                const updatedYml = updateFaviconInYml(docsYmlContent, faviconPath);
                updateDocsYmlContent(docsYmlFilePath, updatedYml);
            }
            void fileToBase64(file).then((base64) => {
                addAssetFile(faviconPath, base64);
            });
        },
        [docsYmlFilePath, docsYmlContent, updateDocsYmlContent, addAssetFile]
    );

    const handleFaviconRemove = useCallback(() => {
        setSettings((prev) => ({ ...prev, favicon: null }));
        if (docsYmlFilePath && docsYmlContent) {
            const updatedYml = removeFaviconFromYml(docsYmlContent);
            updateDocsYmlContent(docsYmlFilePath, updatedYml);
        }
    }, [docsYmlFilePath, docsYmlContent, updateDocsYmlContent]);

    const handleLogoSelect = useCallback(
        (file: File) => {
            const logoPath = file.name;
            setSettings((prev) => ({ ...prev, logo: logoPath }));
            if (docsYmlFilePath && docsYmlContent) {
                const updatedYml = updateLogoInYml(docsYmlContent, logoPath);
                updateDocsYmlContent(docsYmlFilePath, updatedYml);
            }
            const blobUrl = URL.createObjectURL(file);
            setLogoOverrideUrl(blobUrl);
            void fileToBase64(file).then((base64) => {
                addAssetFile(logoPath, base64);
            });
        },
        [docsYmlFilePath, docsYmlContent, updateDocsYmlContent, setLogoOverrideUrl, addAssetFile]
    );

    const handleLogoRemove = useCallback(() => {
        setSettings((prev) => ({ ...prev, logo: null }));
        if (docsYmlFilePath && docsYmlContent) {
            const updatedYml = removeLogoFromYml(docsYmlContent);
            updateDocsYmlContent(docsYmlFilePath, updatedYml);
        }
        setLogoOverrideUrl(null);
    }, [docsYmlFilePath, docsYmlContent, updateDocsYmlContent, setLogoOverrideUrl]);

    return (
        <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-gray-900">Docs site name</label>
                <Input
                    value={settings.title ?? ""}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="My Docs"
                    className="h-9 text-sm"
                />
            </div>

            <div className="mb-4">
                <AccordionToggle
                    label="Favicon"
                    isOpen={isFaviconOpen}
                    onToggle={() => setIsFaviconOpen(!isFaviconOpen)}
                />
                {isFaviconOpen && (
                    <div className="pl-1">
                        <ImageUploadRow
                            previewUrl={existingFaviconUrl}
                            onFileSelect={handleFaviconSelect}
                            onRemove={handleFaviconRemove}
                            description="Upload a 32 x 32 pixel ICO, PNG, GIF, or JPG to display in browser tabs."
                            accept=".ico,.png,.gif,.jpg,.jpeg"
                        />
                    </div>
                )}
            </div>

            <div className="mb-4">
                <AccordionToggle label="Logo" isOpen={isLogoOpen} onToggle={() => setIsLogoOpen(!isLogoOpen)} />
                {isLogoOpen && (
                    <div className="pl-1">
                        <ImageUploadRow
                            previewUrl={existingLogoUrl}
                            onFileSelect={handleLogoSelect}
                            onRemove={handleLogoRemove}
                            description="This will be used as the main logo on the top-left corner of the Docs site."
                        />
                    </div>
                )}
            </div>

            <div className="mb-4">
                <AccordionToggle
                    label="Color palette"
                    isOpen={isColorPaletteOpen}
                    onToggle={() => setIsColorPaletteOpen(!isColorPaletteOpen)}
                />
                {isColorPaletteOpen && (
                    <div className="flex flex-col gap-3 pl-1">
                        {COLOR_FIELDS.map((field) => (
                            <div key={field.key} className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{field.label}</span>
                                <div className="flex items-center gap-3">
                                    <InlineColorSwatch
                                        color={colors[field.key].light}
                                        label="light"
                                        onChange={(c) => handleColorChange(field.key, "light", c)}
                                    />
                                    <InlineColorSwatch
                                        color={colors[field.key].dark}
                                        label="dark"
                                        onChange={(c) => handleColorChange(field.key, "dark", c)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
