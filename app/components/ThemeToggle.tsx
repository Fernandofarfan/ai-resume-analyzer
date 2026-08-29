import React from "react";
import { useThemeStore } from "~/lib/theme";
import { useI18nStore } from "~/lib/i18n";

interface ThemeToggleProps {
    className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
    const { theme, toggleTheme } = useThemeStore();
    const { t } = useI18nStore();

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t.theme.toggleLight : t.theme.toggleDark}
            title={theme === "dark" ? t.theme.toggleLight : t.theme.toggleDark}
            className={`relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer ${className}`}
        >
            {theme === "dark" ? (
                // Sun Icon (when in dark mode)
                <svg
                    className="w-4 h-4 text-amber-400 transform hover:rotate-45 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                </svg>
            ) : (
                // Moon Icon (when in light mode)
                <svg
                    className="w-4 h-4 text-indigo-600 transform hover:-rotate-12 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                </svg>
            )}
        </button>
    );
};

export default ThemeToggle;
