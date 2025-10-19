export function readBuffer(val: Buffer): unknown {
    const raw = val.toString();
    return JSON.parse(raw);
}
