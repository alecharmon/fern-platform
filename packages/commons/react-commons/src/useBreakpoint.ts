import React from "react";

import { isomorphicRequestAnimationFrame } from "./request-callback";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

export function useMinWidth(breakpoint: number): boolean {
  const [largerThanBreakpoint, setLargerThanBreakpoint] =
    React.useState<boolean>(() =>
      typeof window === "undefined" ? true : window.innerWidth >= breakpoint
    );

  useIsomorphicLayoutEffect(() => {
    const cancelAnimationFrame = isomorphicRequestAnimationFrame(() => {
      setLargerThanBreakpoint(window.innerWidth >= breakpoint);
    });

    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      setLargerThanBreakpoint(e.matches);
    };

    mql.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame();
      mql.removeEventListener("change", onChange);
    };
  }, [breakpoint]);

  return !!largerThanBreakpoint;
}

export function useIsMobile(): boolean {
  return !useMinWidth(MOBILE_BREAKPOINT);
}

export function useIsDesktop(): boolean {
  const [sidePanelWidth, setSidePanelWidth] = React.useState(0);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const checkPanelWidth = () => {
        const panelWidth = getComputedStyle(
          document.documentElement
        ).getPropertyValue("--ask-ai-panel-width");

        setSidePanelWidth(parseInt(panelWidth) || 0);
      };

      checkPanelWidth();
      const observer = new MutationObserver(checkPanelWidth);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style"],
      });

      return () => observer.disconnect();
    }
    return undefined;
  }, []);

  return useMinWidth(DESKTOP_BREAKPOINT + sidePanelWidth);
}
