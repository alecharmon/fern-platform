import { slugToHref } from ".";

export function prepareRedirect(destination: string): string {
    if (destination.startsWith("http://") || destination.startsWith("https://")) {
        // triggers a throw in the server-side if the destination url is invalid
        const url = new URL(destination);
        destination = String(url);
    } else {
        destination = encodeURI(slugToHref(destination));
    }
    return destination;
}
