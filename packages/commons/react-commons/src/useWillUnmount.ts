import { useLayoutEffect, useRef } from "react";

import createHandlerSetter, { type CallbackSetter } from "./factory/createHandlerSetter";

/**
 * Returns a callback setter for a callback to be performed when the component will unmount.
 */
const useWillUnmount = <TCallback extends (...args: any[]) => void>(
    callback?: TCallback
): CallbackSetter<undefined> => {
    const mountRef = useRef(false);
    const [handler, setHandler] = createHandlerSetter<undefined>(callback);

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run on mount
    useLayoutEffect(() => {
        mountRef.current = true;

        return () => {
            if (typeof handler?.current === "function" && mountRef.current) {
                handler.current();
            }
        };
    }, []);

    return setHandler;
};

export default useWillUnmount;
