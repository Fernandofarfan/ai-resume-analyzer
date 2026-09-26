// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ThemeToggle from "./ThemeToggle";
import { useThemeStore } from "~/lib/theme";
import { useI18nStore } from "~/lib/i18n";

describe("ThemeToggle", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        useThemeStore.setState({ theme: "light" });
    });

    it("labels the action for the current theme", () => {
        const { t } = useI18nStore.getState();
        useThemeStore.setState({ theme: "light" });
        const { unmount } = render(<ThemeToggle />);
        expect(screen.getByRole("button", { name: t.theme.toggleDark })).toBeInTheDocument();

        unmount();
        useThemeStore.setState({ theme: "dark" });
        render(<ThemeToggle />);
        expect(screen.getByRole("button", { name: t.theme.toggleLight })).toBeInTheDocument();
    });

    it("switches to the opposite theme when clicked", () => {
        useThemeStore.setState({ theme: "light" });
        render(<ThemeToggle />);

        fireEvent.click(screen.getByRole("button"));
        expect(useThemeStore.getState().theme).toBe("dark");
        expect(document.documentElement).toHaveClass("dark");

        fireEvent.click(screen.getByRole("button"));
        expect(useThemeStore.getState().theme).toBe("light");
        expect(document.documentElement).not.toHaveClass("dark");
    });
});
