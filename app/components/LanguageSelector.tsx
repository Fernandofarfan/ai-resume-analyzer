import React from "react";
import { useI18nStore, type Language } from "~/lib/i18n";

interface LanguageSelectorProps {
    className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = "" }) => {
    const { language, setLanguage } = useI18nStore();

    return (
        <div className={`flex items-center bg-gray-100/90 hover:bg-gray-200/90 border border-gray-200 rounded-full p-1 shadow-xs transition-all duration-200 ${className}`}>
            <button
                type="button"
                onClick={() => setLanguage("es")}
                aria-label="Cambiar idioma a Español"
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    language === "es"
                        ? "bg-white text-blue-600 shadow-xs scale-105"
                        : "text-gray-600 hover:text-gray-900"
                }`}
                title="Cambiar idioma a Español"
            >
                <span>🇪🇸</span>
                <span>ES</span>
            </button>
            <button
                type="button"
                onClick={() => setLanguage("en")}
                aria-label="Switch language to English"
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    language === "en"
                        ? "bg-white text-blue-600 shadow-xs scale-105"
                        : "text-gray-600 hover:text-gray-900"
                }`}
                title="Switch language to English"
            >
                <span>🇬🇧</span>
                <span>EN</span>
            </button>
        </div>
    );
};

export default LanguageSelector;
