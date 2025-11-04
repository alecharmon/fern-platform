import { ArrowRightIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import CodeWidget from "./CodeWidget";
import ColorPicker from "./ColorPicker";
import DocsUrl from "./DocsUrl";
import OpenAPISpecs from "./OpenAPISpecs";
import type { WizardFormData } from "./page";
import UploadImage from "./UploadImage";

function UploadForm({
    wizardFormData,
    setWizardFormData,
    onSubmitForm,
    isLoading = false,
    error = null
}: {
    wizardFormData: WizardFormData;
    setWizardFormData: (data: WizardFormData) => void;
    onSubmitForm: () => void;
    isLoading?: boolean;
    error?: string | null;
}) {
    const isFormValid =
        wizardFormData.docsSiteUrlAvailable === true &&
        wizardFormData.docsSiteName.length > 0 &&
        wizardFormData.logoUrl &&
        wizardFormData.faviconUrl &&
        wizardFormData.primaryColorHex;
    return (
        <div className="flex w-full items-start justify-center overflow-y-hidden px-2">
            <div className="mx-auto flex w-fit max-w-[1600px] items-start gap-6 xl:gap-12">
                <div className="flex w-full min-w-[400px] max-w-[500px] flex-col">
                    <div className="mx-auto flex max-h-[calc(100vh-150px)] w-full flex-1 justify-center overflow-y-auto bg-[var(--gray-100)] px-8 py-12 md:rounded-t-2xl">
                        <div className="w-full max-w-[400px]">
                            <div className="space-y-8 pb-24">
                                <div className="space-y-2">
                                    <h1 className="text-gray-1200 text-2xl font-semibold">
                                        Let&apos;s set up your docs site
                                    </h1>
                                    <p className="text-gray-1100 text-sm">You can always change this later.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="company-site" className="text-gray-1200 text-sm font-medium">
                                            Docs site name
                                        </Label>
                                        <Input
                                            id="company-site"
                                            type="text"
                                            placeholder="myorg.com"
                                            value={wizardFormData.docsSiteName}
                                            onChange={(e) =>
                                                setWizardFormData({
                                                    ...wizardFormData,
                                                    docsSiteName: e.target.value
                                                })
                                            }
                                            className="w-full"
                                        />
                                    </div>

                                    <DocsUrl
                                        value={wizardFormData.docsSiteUrl}
                                        onChange={(url, available) =>
                                            setWizardFormData({
                                                ...wizardFormData,
                                                docsSiteUrl: url,
                                                docsSiteUrlAvailable: available
                                            })
                                        }
                                    />

                                    <OpenAPISpecs
                                        uploadedSpecs={wizardFormData.openApiSpecUrls}
                                        setUploadedSpecs={(specs) =>
                                            setWizardFormData({
                                                ...wizardFormData,
                                                openApiSpecUrls: specs
                                            })
                                        }
                                    />

                                    <UploadImage
                                        label="Favicon"
                                        description="Upload a 32 x 32 pixel ICO, PNG, GIF, or JPG to display in browser tabs."
                                        imageUrl={wizardFormData.faviconUrl}
                                        onImageUpload={(url) =>
                                            setWizardFormData({ ...wizardFormData, faviconUrl: url })
                                        }
                                        size="small"
                                        accept="image/x-icon,image/png,image/gif,image/jpeg"
                                    />

                                    <UploadImage
                                        label="Logo"
                                        description="This will be used as the main logo on the top-left corner of the Docs site."
                                        imageUrl={wizardFormData.logoUrl}
                                        onImageUpload={(url) => setWizardFormData({ ...wizardFormData, logoUrl: url })}
                                        size="large"
                                        accept="image/*"
                                    />

                                    <ColorPicker
                                        label="Primary color"
                                        color={wizardFormData.primaryColorHex}
                                        onColorChange={(color) =>
                                            setWizardFormData({
                                                ...wizardFormData,
                                                primaryColorHex: color
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mx-auto w-full max-w-[640px] rounded-b-2xl border-t border-gray-500 bg-[var(--gray-100)] p-4">
                        <div className="mx-auto w-full max-w-[400px] space-y-3">
                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                                    {error}
                                </div>
                            )}
                            <Button
                                onClick={onSubmitForm}
                                variant="default"
                                className="w-full"
                                size="lg"
                                disabled={!isFormValid || isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                        Publishing docs...
                                    </>
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRightIcon className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
                <CodeWidget wizardFormData={wizardFormData} />
            </div>
        </div>
    );
}

export default UploadForm;
