import Image from "next/image";

/**
 * Decorative header illustration for the docs site upsell modal.
 * Renders light/dark SVG images showing a miniature docs site wireframe.
 */
export function DocsSiteHeaderIllustration() {
    return (
        <div className="relative h-[147px] w-full overflow-hidden">
            {/* Light mode image */}
            <Image
                src="/docs-site-upsell-modal-image-light.svg"
                alt=""
                fill
                className="object-cover dark:hidden"
                aria-hidden="true"
            />
            {/* Dark mode image */}
            <Image
                src="/docs-site-upsell-modal-image-dark.svg"
                alt=""
                fill
                className="hidden object-cover dark:block"
                aria-hidden="true"
            />
        </div>
    );
}
