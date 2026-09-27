import { Link } from "react-router";
import ScoreCircle from "~/components/ScoreCircle";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "~/lib/store";
import { useI18nStore } from "~/lib/i18n";
import type { ResumeHeader, Resume } from "~/domain/resume";

const ResumeCard = ({
    resume,
    onDelete,
}: {
    resume: ResumeHeader | Resume;
    onDelete?: (id: string) => void;
}) => {
    const { fs } = useAppStore();
    const { t } = useI18nStore();
    const [resumeUrl, setResumeUrl] = useState("");
    // Distinguishes "still loading" from "nothing to show", so records whose
    // preview read failed do not display a perpetual loading state.
    const [imageUnavailable, setImageUnavailable] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    // Thumbnails are only read from IndexedDB once the card approaches the
    // viewport, so a long list does not decode every preview up front.
    const [nearViewport, setNearViewport] = useState(false);

    const id = resume.id;
    const companyName = resume.companyName;
    const jobTitle = resume.jobTitle;
    const imagePath = resume.imagePath;

    const overallScore =
        typeof (resume as ResumeHeader).overallScore === "number"
            ? (resume as ResumeHeader).overallScore!
            : (resume as Resume).feedback?.overallScore || 0;

    const matchScore =
        (resume as Resume).feedback?.keywords?.matchScore ??
        ((resume as ResumeHeader).matchingKeywords &&
        (resume as ResumeHeader).matchingKeywords!.length > 0
            ? Math.round(
                  ((resume as ResumeHeader).matchingKeywords!.length /
                      Math.max(
                          1,
                          (resume as ResumeHeader).matchingKeywords!.length +
                              ((resume as ResumeHeader).missingKeywords?.length || 0),
                      )) *
                      100,
              )
            : undefined);

    useEffect(() => {
        const node = cardRef.current;
        if (nearViewport) return;
        if (!node || typeof IntersectionObserver === "undefined") {
            // No observer support: fall back to loading immediately.
            setNearViewport(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "300px 0px" },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [nearViewport]);

    useEffect(() => {
        if (!nearViewport || !imagePath) return;
        let cancelled = false;
        let createdUrl: string | null = null;

        const loadResume = async () => {
            try {
                const blob = await fs.read(imagePath);
                if (cancelled) return;
                if (!blob) {
                    setImageUnavailable(true);
                    return;
                }
                createdUrl = URL.createObjectURL(blob);
                if (cancelled) {
                    URL.revokeObjectURL(createdUrl);
                    return;
                }
                setImageUnavailable(false);
                setResumeUrl(createdUrl);
            } catch (err) {
                // A storage failure must not surface as an unhandled rejection;
                // the placeholder below already communicates the missing preview.
                console.warn("Failed to load resume preview:", err);
                if (!cancelled) setImageUnavailable(true);
            }
        };

        void loadResume();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [imagePath, fs, nearViewport]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            onDelete(id);
        }
    };

    return (
        <div
            ref={cardRef}
            className="relative group w-full sm:w-[380px] lg:w-[420px] glass-card flex flex-col justify-between h-[480px] p-5 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 rounded-3xl overflow-hidden"
        >
            {/* Primary navigation overlay link for whole card */}
            <Link
                to={`/resume/${id}`}
                className="absolute inset-0 z-0 rounded-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label={`${companyName || ""} ${jobTitle || t.home.defaultResumeTitle} - ATS ${overallScore}%`}
            />

            {/* Header */}
            <div className="relative z-10 flex items-start justify-between gap-3 pb-3 pointer-events-none">
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
                        <span className="text-xs text-slate-400">{t.home.defaultResumeTitle}</span>
                    )}
                </div>

                <div className="shrink-0 flex items-center gap-1.5 pointer-events-auto">
                    <ScoreCircle score={overallScore} />
                    {onDelete && (
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-rose-500 transition-opacity p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                            aria-label={t.resume.deleteResume}
                            title={t.resume.deleteResume}
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Preview Thumbnail */}
            <div className="relative z-10 flex-1 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 my-2 pointer-events-none">
                {resumeUrl ? (
                    <img
                        src={resumeUrl}
                        alt={`${jobTitle || t.home.defaultResumeTitle}${companyName ? ` - ${companyName}` : ""}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 group-hover:scale-102 transition-all duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                        <span>📄</span>
                        <span className="text-xs">
                            {!imagePath || imageUnavailable
                                ? t.resume.previewUnavailable
                                : t.resume.loadingPreview}
                        </span>
                    </div>
                )}
            </div>

            {/* Footer stats */}
            <div className="relative z-10 pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pointer-events-none">
                <span className="flex items-center gap-1">
                    <span>⚡</span>
                    <span>
                        ATS:{" "}
                        <strong className="text-slate-700 dark:text-slate-200">
                            {overallScore}%
                        </strong>
                    </span>
                </span>
                <div className="flex items-center gap-2">
                    {resume.attachmentsStatus && resume.attachmentsStatus !== "complete" && (
                        <span
                            className={`px-2 py-0.5 rounded-md font-medium text-[11px] flex items-center gap-1 ${
                                resume.attachmentsStatus === "unavailable"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                            title={
                                resume.attachmentsStatus === "unavailable"
                                    ? t.resume.storageErrorTitle
                                    : t.resume.attachmentsPartial
                            }
                        >
                            <span>{resume.attachmentsStatus === "unavailable" ? "💾" : "⚠️"}</span>
                            <span>
                                {resume.attachmentsStatus === "unavailable"
                                    ? t.resume.attachmentsStorageError
                                    : resume.attachmentsStatus === "missing"
                                      ? t.resume.attachmentsNoFiles
                                      : t.resume.attachmentsPartial}
                            </span>
                        </span>
                    )}
                    {typeof matchScore === "number" && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold">
                            {matchScore}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResumeCard;
