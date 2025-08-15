import { useEffect } from "react";

import { sanitizeCSS } from "./css-sanitizer";

interface StyleInjectorProps {
  styles: string;
  id: string;
}

/**
 * Injects CSS styles into the document head.
 */
export const StyleInjector = ({ styles, id }: StyleInjectorProps) => {
  useEffect(() => {
    const styleId = `custom-element-styles-${id}`;

    // Remove existing style tag if it exists
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create and inject new style tag
    const styleTag = document.createElement("style");
    styleTag.id = styleId;
    const sanitizedStyles = sanitizeCSS(styles);
    styleTag.textContent = sanitizedStyles;
    document.head.appendChild(styleTag);

    // Cleanup on unmount
    return () => {
      const elementToRemove = document.getElementById(styleId);
      elementToRemove?.remove();
    };
  }, [styles, id]);

  return null;
};
