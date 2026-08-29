import { Link } from "react-router";
import LanguageSelector from "~/components/LanguageSelector";
import ThemeToggle from "~/components/ThemeToggle";
import { useI18nStore } from "~/lib/i18n";

const Navbar = () => {
    const { t } = useI18nStore();

    return (
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

                    <Link to="/upload" className="primary-button text-xs sm:text-sm py-2 px-4">
                        <span>✨</span>
                        <span>{t.navbar.uploadResume}</span>
                    </Link>
                </div>
            </nav>
        </header>
    );
};

export default Navbar;
