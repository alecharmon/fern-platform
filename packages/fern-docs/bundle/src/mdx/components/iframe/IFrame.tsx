import { FernButton } from "@fern-docs/components/FernButton";
import { MediaBlockedPlaceholder } from "@fern-docs/components/MediaBlockedPlaceholder";
import { usePrevious } from "@fern-ui/react-commons";
import { composeRefs } from "@radix-ui/react-compose-refs";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Expand } from "lucide-react";
import {
    type ComponentProps,
    forwardRef,
    type ReactElement,
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import { useIsAirgapped } from "@/state/airgapped";

/**
 * Default timeout in milliseconds before treating an iframe as failed.
 * Only used in airgapped environments where network requests may hang
 * for a long time before timing out.
 */
const IFRAME_LOAD_TIMEOUT_MS = 15_000;

export declare namespace IFrame {
    export interface Props extends ComponentProps<"iframe"> {
        experimental_enableRequestFullscreen?: boolean;
        experimental_onFullscreenChange?: (isFullscreen: boolean) => void;
        experimental_onReceiveMessage?: (event: MessageEvent) => void;
    }
}

export const IFrame = forwardRef<HTMLIFrameElement, IFrame.Props>(
    (
        {
            experimental_enableRequestFullscreen,
            experimental_onFullscreenChange,
            experimental_onReceiveMessage,
            ...props
        },
        forwardedRef
    ): ReactElement<any> => {
        const iframeRef = useRef<HTMLIFrameElement>(null);
        const isAirgapped = useIsAirgapped();
        const hasTimedOut = useIframeLoadTimeout(iframeRef, props.src, isAirgapped);

        useEffect(() => {
            const contentWindow = iframeRef.current?.contentWindow;
            if (contentWindow == null || experimental_onReceiveMessage == null) {
                return;
            }
            contentWindow.addEventListener("message", experimental_onReceiveMessage);
            return () => {
                contentWindow.removeEventListener("message", experimental_onReceiveMessage);
            };
        }, [experimental_onReceiveMessage]);

        if (hasTimedOut && isAirgapped) {
            return <MediaBlockedPlaceholder type="iframe" />;
        }

        if (experimental_enableRequestFullscreen && typeof document !== "undefined" && document.fullscreenEnabled) {
            return (
                <ExperimentalIFrameWithFullscreen
                    iframeRef={iframeRef}
                    onFullscreenChange={experimental_onFullscreenChange}
                >
                    <iframe ref={composeRefs(iframeRef, forwardedRef)} {...props} />
                </ExperimentalIFrameWithFullscreen>
            );
        }

        // prevent hydration mismatch by setting data-state to closed
        return <iframe data-state="closed" ref={composeRefs(iframeRef, forwardedRef)} {...props} />;
    }
);

IFrame.displayName = "IFrame";

/**
 * Hook that monitors an iframe's load state and returns true if it times out.
 * In airgapped environments, iframes loading external content may hang indefinitely.
 * This hook prevents that from blocking page rendering.
 */
function useIframeLoadTimeout(
    iframeRef: RefObject<HTMLIFrameElement | null>,
    src: string | undefined,
    isAirgapped: boolean
): boolean {
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const loadedRef = useRef(false);

    const handleLoad = useCallback(() => {
        loadedRef.current = true;
    }, []);

    const handleError = useCallback(() => {
        console.error(`[IFrame] Failed to load iframe: ${src}`);
        setHasTimedOut(true);
    }, [src]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || !src) {
            return;
        }

        loadedRef.current = false;
        setHasTimedOut(false);

        iframe.addEventListener("load", handleLoad);
        iframe.addEventListener("error", handleError);

        // Only apply timeout in airgapped environments
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (isAirgapped) {
            timeoutId = setTimeout(() => {
                if (!loadedRef.current) {
                    console.warn(`[IFrame] Iframe load timed out after ${IFRAME_LOAD_TIMEOUT_MS}ms: ${src}`);
                    setHasTimedOut(true);
                }
            }, IFRAME_LOAD_TIMEOUT_MS);
        }

        return () => {
            iframe.removeEventListener("load", handleLoad);
            iframe.removeEventListener("error", handleError);
            if (timeoutId != null) {
                clearTimeout(timeoutId);
            }
        };
    }, [iframeRef, src, handleLoad, handleError, isAirgapped]);

    return hasTimedOut;
}

interface ExperimentalIFrameWithFullscreenProps {
    onFullscreenChange?: (isFullscreen: boolean) => void;
    iframeRef: RefObject<HTMLIFrameElement | null>;
    children: ReactElement<ComponentProps<"iframe">>;
}

const ExperimentalIFrameWithFullscreen = ({
    onFullscreenChange,
    iframeRef,
    children
}: ExperimentalIFrameWithFullscreenProps) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const wasFullscreen = usePrevious(isFullscreen);
    useEffect(() => {
        if (wasFullscreen !== isFullscreen) {
            onFullscreenChange?.(isFullscreen);
        }
    }, [onFullscreenChange, isFullscreen, wasFullscreen]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === iframeRef.current);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [iframeRef]);
    const enterFullscreen = () => {
        if (iframeRef.current == null) {
            return;
        }

        const iframe = iframeRef.current;
        if (document.fullscreenElement != null) {
            void document.exitFullscreen();
        } else {
            void iframe.requestFullscreen();
        }
    };

    return (
        <Tooltip.TooltipProvider delayDuration={300}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content side="right" align="start" sideOffset={6} className="animate-popover">
                        <FernButton variant="outlined" icon={<Expand />} onClick={enterFullscreen} />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.TooltipProvider>
    );
};
