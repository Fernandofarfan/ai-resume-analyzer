import React, { useState, useEffect } from "react";
import { useAppStore } from "~/lib/store";
import { useI18nStore } from "~/lib/i18n";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { ai } = useAppStore();
    const { t } = useI18nStore();
    const [provider, setProvider] = useState<"offline" | "gemini" | "groq" | "ollama">("offline");
    const [apiKey, setApiKey] = useState("");
    const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const config = ai.getSettings();
            setProvider(config.provider || "offline");
            setApiKey(config.apiKey || "");
            setOllamaEndpoint(config.ollamaEndpoint || "http://localhost:11434");
            setSaved(false);
        }
    }, [isOpen, ai]);

    if (!isOpen) return null;

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        ai.saveSettings({
            provider,
            apiKey,
            ollamaEndpoint,
        });
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 800);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>⚙️</span>
                            <span>{t.settings.modalTitle}</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {t.settings.subtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    {/* Providers Radio List */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {t.settings.providerLabel}
                        </label>

                        {/* Offline Option */}
                        <div
                            onClick={() => setProvider("offline")}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                provider === "offline"
                                    ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30"
                                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                            }`}
                        >
                            <input
                                type="radio"
                                name="provider"
                                checked={provider === "offline"}
                                onChange={() => setProvider("offline")}
                                className="mt-1 accent-indigo-600"
                            />
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>🔒</span> {t.settings.offlineOption}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {t.settings.offlineDesc}
                                </p>
                            </div>
                        </div>

                        {/* Gemini Option */}
                        <div
                            onClick={() => setProvider("gemini")}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                provider === "gemini"
                                    ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30"
                                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                            }`}
                        >
                            <input
                                type="radio"
                                name="provider"
                                checked={provider === "gemini"}
                                onChange={() => setProvider("gemini")}
                                className="mt-1 accent-indigo-600"
                            />
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>✨</span> {t.settings.geminiOption}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {t.settings.geminiDesc}
                                </p>
                            </div>
                        </div>

                        {/* Groq Option */}
                        <div
                            onClick={() => setProvider("groq")}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                provider === "groq"
                                    ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30"
                                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                            }`}
                        >
                            <input
                                type="radio"
                                name="provider"
                                checked={provider === "groq"}
                                onChange={() => setProvider("groq")}
                                className="mt-1 accent-indigo-600"
                            />
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>⚡</span> {t.settings.groqOption}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {t.settings.groqDesc}
                                </p>
                            </div>
                        </div>

                        {/* Ollama Option */}
                        <div
                            onClick={() => setProvider("ollama")}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                provider === "ollama"
                                    ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30"
                                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                            }`}
                        >
                            <input
                                type="radio"
                                name="provider"
                                checked={provider === "ollama"}
                                onChange={() => setProvider("ollama")}
                                className="mt-1 accent-indigo-600"
                            />
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>🦙</span> {t.settings.ollamaOption}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {t.settings.ollamaDesc}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* API Key or Endpoint Inputs */}
                    {(provider === "gemini" || provider === "groq") && (
                        <div className="space-y-1.5 animate-in fade-in duration-200">
                            <label className="text-xs font-semibold">{t.settings.apiKeyLabel}</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={t.settings.apiKeyPlaceholder}
                                className="text-sm font-mono"
                            />
                        </div>
                    )}

                    {provider === "ollama" && (
                        <div className="space-y-1.5 animate-in fade-in duration-200">
                            <label className="text-xs font-semibold">{t.settings.ollamaEndpointLabel}</label>
                            <input
                                type="text"
                                value={ollamaEndpoint}
                                onChange={(e) => setOllamaEndpoint(e.target.value)}
                                placeholder="http://localhost:11434"
                                className="text-sm font-mono"
                            />
                        </div>
                    )}

                    {saved && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                            ✓ {t.settings.savedNotice}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="secondary-button flex-1 text-sm"
                        >
                            {t.resume.cancelDelete}
                        </button>
                        <button
                            type="submit"
                            className="primary-button flex-1 text-sm"
                        >
                            {t.settings.saveBtn}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsModal;
