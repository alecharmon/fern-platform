import { isEqual } from "es-toolkit/predicate";
import React from "react";

type UseEffectParams = Parameters<typeof React.useEffect>;
type EffectCallback = UseEffectParams[0];
type DependencyList = UseEffectParams[1];
// yes, I know it's void, but I like what this communicates about
// the intent of these functions: It's just like useEffect
type UseEffectReturn = ReturnType<typeof React.useEffect>;

function checkDeps(deps: DependencyList) {
    if (!deps?.length) {
        throw new Error("useDeepCompareEffect should not be used with no dependencies. Use React.useEffect instead.");
    }
    if (deps.every(isPrimitive)) {
        throw new Error(
            "useDeepCompareEffect should not be used with dependencies that are all primitive values. Use React.useEffect instead."
        );
    }
}

function isPrimitive(val: unknown) {
    return val == null || /^[sbn]/.test(typeof val);
}

/**
 * @param value the value to be memoized (usually a dependency list)
 * @returns a memoized version of the value as long as it remains deeply equal
 */
export function useDeepCompareMemoize<T>(value: T): T {
    const ref = React.useRef<T>(value);
    const signalRef = React.useRef<number>(0);

    if (!isEqual(value, ref.current)) {
        ref.current = value;
        signalRef.current += 1;
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: signalRef.current is a dependency of the memoization
    return React.useMemo(() => ref.current, [signalRef.current]);
}

export function useDeepCompareEffect(callback: EffectCallback, dependencies: DependencyList): UseEffectReturn {
    if (process.env.NODE_ENV !== "production") {
        checkDeps(dependencies);
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are memoized
    return React.useEffect(callback, useDeepCompareMemoize(dependencies));
}

export function useDeepCompareEffectNoCheck(callback: EffectCallback, dependencies: DependencyList): UseEffectReturn {
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are memoized
    return React.useEffect(callback, useDeepCompareMemoize(dependencies));
}
