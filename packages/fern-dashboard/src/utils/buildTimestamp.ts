export function getBuildTimestamp(): string {
    return process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || "";
}
