import { t } from "@fern-docs/i18n";
import { Laptop, Moon, Sun } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import * as Command from "../cmdk";

export const CommandGroupTheme = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof Command.Group> & {
        setTheme?: (theme: "light" | "dark" | "system") => void;
        lang: string;
    }
>(({ setTheme, lang, ...props }, ref) => {
    if (setTheme == null) {
        return false;
    }

    return (
        <Command.Group heading={t(lang).search.theme} ref={ref} {...props}>
            <Command.Item
                value="change theme to light"
                onSelect={() => setTheme("light")}
                keywords={["light mode", "light theme"]}
            >
                <Sun />
                {t(lang).search.changeThemeToLight}
            </Command.Item>
            <Command.Item
                value="change theme to dark"
                onSelect={() => setTheme("dark")}
                keywords={["dark mode", "dark theme"]}
            >
                <Moon />
                {t(lang).search.changeThemeToDark}
            </Command.Item>
            <Command.Item
                value="change theme to system"
                onSelect={() => setTheme("system")}
                keywords={["system mode", "system theme"]}
            >
                <Laptop />
                {t(lang).search.changeThemeToSystem}
            </Command.Item>
        </Command.Group>
    );
});

CommandGroupTheme.displayName = "CommandGroupTheme";
