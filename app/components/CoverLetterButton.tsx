import { useI18nStore } from "~/lib/i18n";

interface CoverLetterButtonProps {
    onClick: () => void;
    className?: string;
}

export default function CoverLetterButton({ onClick, className }: CoverLetterButtonProps) {
    const { t } = useI18nStore();

    return (
        <button
            type="button"
            onClick={onClick}
            className={className || "secondary-button text-xs font-semibold py-1.5 px-3 inline-flex items-center gap-1.5"}
            title={t.resume.coverLetterBtn}
            aria-label={t.resume.coverLetterBtn}
        >
            <span>✉️</span>
            <span>{t.resume.coverLetterBtn}</span>
        </button>
    );
}
