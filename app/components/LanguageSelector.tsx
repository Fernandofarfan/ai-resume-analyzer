import React from "react";
import { useI18nStore } from "~/lib/i18n";

interface LanguageSelectorProps {
    className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = "" }) => {
    const { language, setLanguage, t } = useI18nStore();

    return (
        <div className={`flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full p-1 shadow-xs transition-all duration-200 ${className}`}>
            <button
                type="button"
                onClick={() => setLanguage("es")}
                aria-label={t.languageSelector.spanish}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    language === "es"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs scale-102"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title={t.languageSelector.spanish}
            >
                <span>🇪🇸</span>
                <span>ES</span>
            </button>
            <button
                type="button"
                onClick={() => setLanguage("en")}
                aria-label={t.languageSelector.english}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    language === "en"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs scale-102"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title={t.languageSelector.english}
            >
                <span>🇬🇧</span>
                <span>EN</span>
            </button>
        </div>
    );
};

export default LanguageSelector;
