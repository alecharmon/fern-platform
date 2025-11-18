/**
 * Truncates a string to the specified byte length.
 * @param str - The string to truncate.
 * @param byteSize - The byte size of the truncated string. i.e. 10KB = 50 * 1000
 * @returns The truncated string.
 */
export function truncateToBytes(str: string, byteSize: number): string {
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(str);
    const truncatedBytes = utf8Bytes.slice(0, byteSize);
    return new TextDecoder().decode(truncatedBytes);
}
