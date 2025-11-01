import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import { getProducts } from "@fern-api/docs-server/handle-node-fallbacks";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import Image from "next/image";
import { processIcon } from "../processIcon";
import { ProductDropdownClient, type ProductDropdownItem } from "./ProductDropdownClient";

export declare namespace ProductDropdown {
    export interface Props {}
}

export async function ProductDropdown({
    loader,
    fallbackProduct,
    useDenseLayout = false
}: {
    loader: DocsLoader;
    fallbackProduct: FernNavigation.ProductNode;
    useDenseLayout?: boolean;
}) {
    const root = await loader.getRoot();
    if (root.child.type !== "productgroup") {
        return null;
    }

    const showHiddenNodes = (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable;
    const authState = await loader.getAuthState();
    const roles = authState.authed ? (authState.user.roles ?? []) : [];

    const products = getProducts(root, showHiddenNodes, roles);

    if (products?.length === 0) {
        return null;
    }

    const files = await loader.getFiles();

    const resolveFileSrc = createFileResolver(files);

    const productOptions = products?.map((product: FernNavigation.ProductNode): ProductDropdownItem => {
        // external products (productLink) use href, internal products (product) use slug
        const slug = product.type === "productLink" ? product.href : (product.slug ?? product.pointsTo);
        const image = resolveFileSrc(product.image);
        return {
            productId: product.productId,
            title: product.title,
            slug: product.type === "product" ? (product.slug ?? product.pointsTo) : undefined,
            href: product.type === "productLink" ? product.href : undefined,
            defaultSlug: product.default && product.type === "product" ? slug : undefined,
            icon: processIcon(product),
            subtitle: product.subtitle,
            default: product.default,
            image: image ? (
                <Image
                    src={image?.src}
                    alt={product.title}
                    objectFit="cover"
                    width={image.width || undefined}
                    height={image.height || undefined}
                />
            ) : undefined
        };
    });

    return (
        <ProductDropdownClient
            products={productOptions ?? []}
            fallbackProduct={fallbackProduct}
            useDenseLayout={useDenseLayout}
        />
    );
}
