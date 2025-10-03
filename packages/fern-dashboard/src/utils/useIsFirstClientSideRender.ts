import { useEffect, useState } from "react";

export function useIsFirstClientSideRender() {
    const [isFirstClientSideRender, setIsFirstClientSideRender] = useState(true);
    useEffect(() => {
        setIsFirstClientSideRender(false);
    }, []);
    return isFirstClientSideRender;
}
