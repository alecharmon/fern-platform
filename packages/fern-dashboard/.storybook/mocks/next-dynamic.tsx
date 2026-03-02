/**
 * Stub for next/dynamic used by Storybook.
 * Uses React.lazy + Suspense so the component re-renders once the loader resolves.
 */
import { type ComponentType, lazy, Suspense } from "react";

export default function dynamic<P = Record<string, unknown>>(
    loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>
): ComponentType<P> {
    const LazyComponent = lazy(() =>
        loader().then((mod) => ({
            default: "default" in mod ? mod.default : mod
        }))
    );

    const DynamicComponent = (props: P) => (
        <Suspense fallback={null}>
            <LazyComponent {...(props as Record<string, unknown>)} />
        </Suspense>
    );

    DynamicComponent.displayName = "DynamicComponent";
    return DynamicComponent as ComponentType<P>;
}
