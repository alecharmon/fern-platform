import "server-only";

import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { cookies } from "next/headers";

export async function getFernToken() {
    const cookieJar = await cookies();
    return cookieJar.get(COOKIE_FERN_TOKEN)?.value;
}
