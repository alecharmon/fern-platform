import { useLazyRef } from "@fern-ui/react-commons";
import { useAtomValue } from "jotai";

import { atomWithStorageString } from "@/state/utils/atomWithStorageString";

const ALGOLIA_USER_TOKEN_KEY = "algolia-user-token";

export function useAlgoliaUserToken() {
    const userTokenRef = useLazyRef(() =>
        atomWithStorageString(ALGOLIA_USER_TOKEN_KEY, `anonymous-user-${crypto.randomUUID()}`, { getOnInit: true })
    );
    return useAtomValue(userTokenRef.current);
}
