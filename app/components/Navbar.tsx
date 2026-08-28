import { Link } from "react-router";
import LanguageSelector from "~/components/LanguageSelector";
import { useI18nStore } from "~/lib/i18n";

const Navbar = () => {
    const { t } = useI18nStore();

    return (
        <nav className="navbar">
            <Link to="/" className="flex items-center gap-2">
                <p className="text-2xl font-bold text-gradient">{t.navbar.appName}</p>
            </Link>

            <div className="flex items-center gap-4">
                <LanguageSelector />
                <Link to="/upload" className="primary-button w-fit">
                    {t.navbar.uploadResume}
                </Link>
            </div>
        </nav>
    );
};

export default Navbar;
