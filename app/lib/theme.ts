import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeStore {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
    if (typeof window !== "undefined") {
        try {
            const saved = localStorage.getItem("cvision_theme") as Theme;
            if (saved === "light" || saved === "dark") {
                return saved;
            }
        } catch {
            // Storage access blocked or restricted
        }
        try {
            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                return "dark";
            }
        } catch {
            // Media query match failed
        }
    }
    return "dark"; // Default to sleek modern dark mode
};

const applyThemeToDOM = (theme: Theme) => {
    if (typeof document !== "undefined") {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        try {
            localStorage.setItem("cvision_theme", theme);
        } catch {
            // Storage access blocked or restricted
        }
    }
};

export const useThemeStore = create<ThemeStore>((set, get) => {
    // Apply theme on initial load
    if (typeof window !== "undefined") {
        const initial = getInitialTheme();
        applyThemeToDOM(initial);
    }

    return {
        theme: getInitialTheme(),
        toggleTheme: () => {
            const next = get().theme === "dark" ? "light" : "dark";
            applyThemeToDOM(next);
            set({ theme: next });
        },
        setTheme: (theme: Theme) => {
            applyThemeToDOM(theme);
            set({ theme });
        },
    };
});
