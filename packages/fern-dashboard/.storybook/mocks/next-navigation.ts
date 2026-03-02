/**
 * Stub for next/navigation used by Storybook.
 * Provides no-op implementations of the hooks the dashboard components use.
 */

export function useRouter() {
    return {
        push: (url: string) => console.log("[storybook] router.push:", url),
        replace: (url: string) => console.log("[storybook] router.replace:", url),
        back: () => console.log("[storybook] router.back"),
        forward: () => console.log("[storybook] router.forward"),
        refresh: () => console.log("[storybook] router.refresh"),
        prefetch: () => Promise.resolve()
    };
}

export function usePathname() {
    return "/storybook";
}

export function useSearchParams() {
    return new URLSearchParams();
}

export function useParams() {
    return {};
}

export function redirect(url: string) {
    console.log("[storybook] redirect:", url);
}

export function notFound() {
    console.log("[storybook] notFound");
}
