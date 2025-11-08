import useBaseUrl from "@docusaurus/useBaseUrl";

interface ExternalDependencyComponentProps {
    imagePath: string;
    caption?: string;
}

export const ExternalDependencyComponent = ({ imagePath, caption }: ExternalDependencyComponentProps) => {
    const imageUrl = useBaseUrl(imagePath);

    return (
        <div className="external-dep-component">
            <img src={imageUrl} alt={caption || "Image"} />
            {caption && <p className="caption">{caption}</p>}
        </div>
    );
};
