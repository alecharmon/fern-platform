export function assertNever(x: never): never {
    throw new Error("Unexpected value: " + JSON.stringify(x));
}

export function assertNeverNoThrow(_: never): void {}
