import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import { Chip } from "@/components/Chip";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { EnumValueWithSerializedDescription } from "@/mdx/plugins/serialize-type-definition-descriptions";

import { SerializedMdxRenderer } from "./SerializedMdxRenderer";

export function EnumValue({
    enumValue,
    lang
}: {
    enumValue: ApiDefinition.EnumValue | EnumValueWithSerializedDescription;
    lang: string;
}) {
    const serializedDescription = (enumValue as EnumValueWithSerializedDescription).serializedDescription;

    // Determine description content
    let descriptionContent: React.ReactNode = null;
    if (serializedDescription) {
        // Use pre-serialized description (from Schema component in MDX)
        descriptionContent = (
            <SerializedMdxRenderer
                serializedDescription={serializedDescription}
                fallback={enumValue.description}
                size="xs"
            />
        );
    } else if (enumValue.description) {
        // Use server-side serialization (for API reference pages)
        descriptionContent = <MdxServerComponentProseSuspense mdx={enumValue.description} size="xs" />;
    }

    return <Chip name={enumValue.value} description={descriptionContent} lang={lang} />;
}
