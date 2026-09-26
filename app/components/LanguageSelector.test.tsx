// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LanguageSelector from "./LanguageSelector";
import { useI18nStore } from "~/lib/i18n";

describe("LanguageSelector", () => {
    afterEach(() => {
        useI18nStore.setState({ language: "es" });
    });

    it("switches the active language to English", () => {
        render(<LanguageSelector />);
        const { t } = useI18nStore.getState();

        fireEvent.click(screen.getByRole("button", { name: t.languageSelector.english }));

        expect(useI18nStore.getState().language).toBe("en");
        expect(
            screen.getByRole("button", {
                name: useI18nStore.getState().t.languageSelector.english,
            }),
        ).toBeInTheDocument();
    });

    it("switches the active language back to Spanish", () => {
        useI18nStore.setState({ language: "en" });
        render(<LanguageSelector />);

        fireEvent.click(
            screen.getByRole("button", {
                name: useI18nStore.getState().t.languageSelector.spanish,
            }),
        );

        expect(useI18nStore.getState().language).toBe("es");
    });
});
