export const getHostnameFromUrl = (url: string) => {
    if (url.startsWith("http")) {
        return new URL(url).hostname;
    }
    return new URL(decodeURIComponent(`https://${url}`)).hostname;
};
