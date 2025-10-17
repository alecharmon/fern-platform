import type { ObjectProperty, TypeDefinition, TypeReference } from "@fern-api/fdr-sdk/api-definition";
import { PlaygroundObjectPropertiesForm } from "@/components/playground/form/PlaygroundObjectPropertyForm";

interface RunnableEndpointFormSectionProps {
    id: string;
    title: string;
    properties: readonly ObjectProperty[];
    extraProperties?: TypeReference;
    value: unknown;
    onChange: (value: ((old: unknown) => unknown) | unknown) => void;
    types: Record<string, TypeDefinition>;
}

export function RunnableEndpointFormSection({
    id,
    title,
    properties,
    extraProperties,
    value,
    onChange,
    types
}: RunnableEndpointFormSectionProps) {
    if (!properties || properties.length === 0) {
        return null;
    }

    return (
        <section>
            <h5 className="text-(color:--grayscale-a11) mb-2 text-sm font-medium">{title}</h5>
            <div className="bg-(color:--grayscale-a2) rounded-2 p-3">
                <PlaygroundObjectPropertiesForm
                    id={id}
                    properties={properties}
                    extraProperties={extraProperties}
                    onChange={onChange}
                    value={value}
                    types={types}
                />
            </div>
        </section>
    );
}
