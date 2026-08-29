import { Link } from "react-router";
import ScoreCircle from "~/components/ScoreCircle";
import { useEffect, useState } from "react";
import { useAppStore } from "~/lib/store";
import { useI18nStore } from "~/lib/i18n";

const ResumeCard = ({
    resume: { id, companyName, jobTitle, feedback, imagePath },
    onDelete,
}: {
    resume: Resume;
    onDelete?: (id: string) => void;
}) => {
    const { fs } = useAppStore();
    const { t } = useI18nStore();
    const [resumeUrl, setResumeUrl] = useState("");

    useEffect(() => {
        let url: string | null = null;
        const loadResume = async () => {
            const blob = await fs.read(imagePath);
            if (!blob) return;
            url = URL.createObjectURL(blob);
            setResumeUrl(url);
        };

        loadResume();

        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [imagePath]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            onDelete(id);
        }
    };

    return (
        <div className="relative group w-full sm:w-[380px] lg:w-[420px]">
            <Link
                to={`/resume/${id}`}
                className="glass-card flex flex-col justify-between h-[480px] p-5 block hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 rounded-3xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        {companyName && (
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate">
                                {companyName}
                            </span>
                        )}
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                            {jobTitle || t.home.defaultResumeTitle}
                        </h3>
                        {!companyName && !jobTitle && (
                            <span className="text-xs text-slate-400">
                                {t.home.defaultResumeTitle}
                            </span>
                        )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                        <ScoreCircle score={feedback.overallScore} />
                        {onDelete && (
                            <button
                                type="button"
                                onClick={handleDeleteClick}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                                title={t.resume.deleteResume}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Preview Thumbnail */}
                <div className="relative flex-1 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 my-2">
                    {resumeUrl ? (
                        <img
                            src={resumeUrl}
                            alt="resume thumbnail"
                            className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 group-hover:scale-102 transition-all duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <span className="text-xs">Cargando vista previa...</span>
                        </div>
                    )}
                </div>

                {/* Footer stats */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                        <span>⚡</span>
                        <span>ATS: <strong className="text-slate-700 dark:text-slate-200">{feedback.ATS.score || feedback.overallScore}%</strong></span>
                    </span>
                    {feedback.keywords && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold">
                            {feedback.keywords.matchScore}% Match
                        </span>
                    )}
                </div>
            </Link>
        </div>
    );
};

export default ResumeCard;
