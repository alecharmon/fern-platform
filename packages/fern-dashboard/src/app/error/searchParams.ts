export const ErrorPageSearchParam = {
    ERROR: "error",
    MESSAGE: "message"
} as const;

export type ErrorPageSearchParam = (typeof ErrorPageSearchParam)[keyof typeof ErrorPageSearchParam];

export function buildErrorPageSearchParams(auth0ErrorSearchParams: URLSearchParams): URLSearchParams {
    const error = auth0ErrorSearchParams.get("error");
    const message = auth0ErrorSearchParams.get("error_description");

    const errorPageSearchParams = new URLSearchParams();
    if (error != null) {
        errorPageSearchParams.append(ErrorPageSearchParam.ERROR, error);
    }
    if (message != null) {
        errorPageSearchParams.append(ErrorPageSearchParam.MESSAGE, message);
    }
    return errorPageSearchParams;
}

export async function parseErrorPageSearchParams(
    params: Promise<Record<string, string | string[]>>
): Promise<Record<ErrorPageSearchParam, string | undefined>> {
    const { [ErrorPageSearchParam.ERROR]: error, [ErrorPageSearchParam.MESSAGE]: message } = await params;

    return {
        [ErrorPageSearchParam.ERROR]: parseSearchParamValue(error),
        [ErrorPageSearchParam.MESSAGE]: parseSearchParamValue(message)
    };
}

function parseSearchParamValue(value: string | string[] | undefined) {
    if (value == null || typeof value === "string") {
        return value;
    }
    return value[0];
}
