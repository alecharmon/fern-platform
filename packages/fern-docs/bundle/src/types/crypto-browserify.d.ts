declare module "crypto-browserify" {
    export function randomBytes(size: number): Buffer;
    export function createHash(algorithm: string): any;
    export function createHmac(algorithm: string, key: string | Buffer): any;
    export function createCipher(algorithm: string, password: string | Buffer): any;
    export function createDecipher(algorithm: string, password: string | Buffer): any;
    export function createSign(algorithm: string): any;
    export function createVerify(algorithm: string): any;
    export function createDiffieHellman(prime: number | Buffer, encoding?: string): any;
    export function pbkdf2(
        password: string | Buffer,
        salt: string | Buffer,
        iterations: number,
        keylen: number,
        digest: string,
        callback: (err: Error | null, derivedKey: Buffer) => void
    ): void;
    export function pbkdf2Sync(
        password: string | Buffer,
        salt: string | Buffer,
        iterations: number,
        keylen: number,
        digest: string
    ): Buffer;
    export function randomFill<T extends Buffer | Uint8Array>(
        buffer: T,
        callback: (err: Error | null, buf: T) => void
    ): void;
    export function randomFillSync<T extends Buffer | Uint8Array>(buffer: T, offset?: number, size?: number): T;
    export const constants: any;
}
