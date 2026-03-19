import type { PropsWithChildren } from "react";
import { Providers } from "../providers/providers";
import { FernThemeProvider } from "../theme";
import { GlobalStyles } from "../theming/global-styles";

import { getFernThemeData } from "./getFernThemeData";

interface FernThemedPageProps {
    lang?: string;
    fallback?: React.ReactNode;
}

export async function FernThemedPage({ lang = "en", fallback, children }: PropsWithChildren<FernThemedPageProps>) {
    const themeData = await getFernThemeData();

    if (!themeData) {
        return (
            <html lang={lang}>
                <body className="antialiased">{fallback ?? children}</body>
            </html>
        );
    }

    const { domain, colors, layout, fonts, theme } = themeData;

    return (
        <html lang={lang} suppressHydrationWarning>
            <head>
                <GlobalStyles
                    domain={domain}
                    layout={layout}
                    fonts={fonts}
                    light={colors.light}
                    dark={colors.dark}
                    theme={theme}
                />
            </head>
            <body className="bg-(color:--background) font-body antialiased">
                <Providers skipProgressProvider>
                    <FernThemeProvider
                        hasLight={Boolean(colors.light)}
                        hasDark={Boolean(colors.dark)}
                        lightThemeColor={colors.light?.themeColor}
                        darkThemeColor={colors.dark?.themeColor}
                    >
                        {children}
                    </FernThemeProvider>
                </Providers>
            </body>
        </html>
    );
}
