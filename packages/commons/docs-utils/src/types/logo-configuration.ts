import type { FileData } from "./file-data";

export interface LogoConfiguration {
    height: number | undefined;
    href: string | undefined;
    light: FileData | undefined;
    dark: FileData | undefined;
}
