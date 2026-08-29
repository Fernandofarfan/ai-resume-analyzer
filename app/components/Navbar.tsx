import { useState } from "react";
import { Link } from "react-router";
import LanguageSelector from "~/components/LanguageSelector";
import ThemeToggle from "~/components/ThemeToggle";
import SettingsModal from "~/components/SettingsModal";
import { useI18nStore } from "~/lib/i18n";

const Navbar = () => {
    const { t } = useI18nStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <>
            <header className="sticky top-0 z-40 w-full px-4 sm:px-8 pt-4 pb-2">
                <nav className="max-w-7xl mx-auto flex items-center justify-between p-3.5 sm:px-6 rounded-2xl bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                    {/* Brand Logo */}
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
                            <span className="text-white font-black text-lg">C</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {t.navbar.appName}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 hidden sm:block">
                                {t.navbar.tagline}
                            </span>
                        </div>
                    </Link>

                    {/* Controls & CTA */}
                    <div className="flex items-center gap-2.5 sm:gap-3.5">
                        <LanguageSelector />
                        <ThemeToggle />

                        {/* Settings Button */}
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(true)}
                            aria-label={t.navbar.settings}
                            title={t.navbar.settings}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>

                        <Link to="/upload" className="primary-button text-xs sm:text-sm py-2 px-4">
                            <span>✨</span>
                            <span>{t.navbar.uploadResume}</span>
                        </Link>
                    </div>
                </nav>
            </header>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </>
    );
};

export default Navbar;
