import type { useForm } from "@tanstack/react-form";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useCallback } from "react";
import { AutoPopulate } from "@/components/onboarding/AutoPopulate";
import { CodeWidget } from "@/components/onboarding/CodeWidget";
import { ColorPicker } from "@/components/onboarding/ColorPicker";
import { DocsUrl } from "@/components/onboarding/DocsUrl";
import { OpenAPISpecs } from "@/components/onboarding/OpenAPISpecs";
import { UploadImage } from "@/components/onboarding/UploadImage";
import { nameToUrl, validateDocsSiteName, validateDocsSiteUrl } from "@/components/onboarding/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ValidationErrors, WizardFormData } from "@/providers/OnboardingProvider";

function UploadForm({
    form,
    formData,
    validationErrors,
    onSubmitForm,
    isLoading = false,
    error = null
}: {
    form: ReturnType<typeof useForm<WizardFormData>>;
    formData: WizardFormData;
    validationErrors: ValidationErrors;
    onSubmitForm: (values: WizardFormData) => void | Promise<void>;
    isLoading?: boolean;
    error?: string | null;
}) {
    const applyAutoPopulateUpdates = useCallback(
        (updates: Partial<WizardFormData>) => {
            Object.entries(updates).forEach(([key, value]) => {
                form.setFieldValue(key as keyof WizardFormData, value as WizardFormData[keyof WizardFormData]);
            });
        },
        [form]
    );

    return (
        <form
            onSubmit={async (event) => {
                event.preventDefault();
                await onSubmitForm(formData);
            }}
            className="flex w-full items-start justify-center overflow-y-hidden px-2"
        >
            <div className="mx-auto mt-2 flex w-fit max-w-[1600px] items-start gap-6 xl:gap-12">
                <div className="flex w-[40%] flex-col">
                    <div className="lg:px-30 mx-auto flex max-h-[calc(100vh-150px)] w-full flex-1 justify-center overflow-y-auto bg-[var(--gray-100)] px-8 py-12 md:rounded-t-2xl md:px-20 md:pt-20">
                        <div className="w-full max-w-[400px]">
                            <div className="space-y-8 pb-24">
                                <div className="space-y-2">
                                    <h1 className="text-gray-1200 text-2xl font-semibold">
                                        Let&apos;s set up your docs site
                                    </h1>
                                    <p className="text-gray-1100 text-sm">You can always change this later.</p>
                                </div>

                                <AutoPopulate onApplyUpdates={applyAutoPopulateUpdates} />

                                <div className="space-y-6">
                                    <form.Field
                                        name="docsSiteName"
                                        validators={{
                                            onSubmit: ({ value }) => validateDocsSiteName(value)
                                        }}
                                    >
                                        {(field) => (
                                            <div className="flex flex-col gap-2">
                                                <Label
                                                    htmlFor="company-site"
                                                    className="text-gray-1200 dark:text-gray-1100 text-sm font-normal"
                                                >
                                                    Site title
                                                </Label>
                                                <Input
                                                    id="company-site"
                                                    type="text"
                                                    placeholder="plantstore.com"
                                                    value={field.state.value}
                                                    onChange={(e) => {
                                                        const newName = e.target.value;
                                                        field.setValue(newName);
                                                        form.setFieldValue("docsSiteUrl", nameToUrl(newName));
                                                    }}
                                                    className="w-full"
                                                />
                                                {field.state.meta.errors[0] && (
                                                    <p className="text-xs text-red-600">{field.state.meta.errors[0]}</p>
                                                )}
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field
                                        name="docsSiteUrl"
                                        validators={{
                                            onChange: ({ value }) => validateDocsSiteUrl(value),
                                            onSubmit: ({ value }) =>
                                                validateDocsSiteUrl(value, formData.docsSiteUrlAvailable)
                                        }}
                                    >
                                        {(field) => (
                                            <div className="flex flex-col gap-1">
                                                <DocsUrl
                                                    value={field.state.value}
                                                    onChange={(url, available) => {
                                                        field.setValue(url);
                                                        form.setFieldValue("docsSiteUrlAvailable", available);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field name="openApiSpecFiles">
                                        {(field) => (
                                            <div className="flex flex-col gap-1">
                                                <OpenAPISpecs
                                                    uploadedFiles={field.state.value}
                                                    setUploadedFiles={(files) => field.setValue(files)}
                                                />
                                                {validationErrors.openApiSpecFiles && (
                                                    <p className="text-xs text-red-600">
                                                        {validationErrors.openApiSpecFiles}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field name="faviconFile">
                                        {(field) => (
                                            <UploadImage
                                                label="Favicon"
                                                description="Upload a 32 x 32 pixel ICO, PNG, GIF, or JPG to display in browser tabs."
                                                imageUrl={formData.faviconUrl}
                                                onFileSelect={(file) => field.setValue(file)}
                                                size="small"
                                                accept="image/x-icon,image/png,image/gif"
                                            />
                                        )}
                                    </form.Field>

                                    <form.Field name="logoFile">
                                        {(field) => (
                                            <UploadImage
                                                label="Logo"
                                                description="This will be used as the main logo on the top-left corner of the Docs site."
                                                imageUrl={formData.logoUrl}
                                                onFileSelect={(file) => field.setValue(file)}
                                                size="large"
                                                accept="image/png,image/gif,image/svg+xml"
                                            />
                                        )}
                                    </form.Field>

                                    <form.Field name="primaryColorHex">
                                        {(field) => (
                                            <div className="flex flex-col gap-1">
                                                <ColorPicker
                                                    label="Primary color"
                                                    color={field.state.value}
                                                    onColorChange={(color) => field.setValue(color)}
                                                />
                                                {validationErrors.primaryColorHex && (
                                                    <p className="text-xs text-red-600">
                                                        {validationErrors.primaryColorHex}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </form.Field>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:px-30 rounded-0 mx-auto w-full border-t border-gray-500 bg-[var(--gray-100)] p-4 md:px-20">
                        <div className="mx-auto w-full space-y-3">
                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                                    {error}
                                </div>
                            )}
                            <Button type="submit" variant="default" className="w-full" size="lg" disabled={isLoading}>
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
                <CodeWidget wizardFormData={formData} />
            </div>
        </form>
    );
}

export default UploadForm;
