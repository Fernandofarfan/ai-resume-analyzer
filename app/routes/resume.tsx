import { Link, useParams, useNavigate } from "react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import {
    useAppStore,
    generateResumeFeedback,
    getResumeEntity,
    saveResumeEntity,
    deleteResumeEntity,
} from "~/lib/store";
import { extractPdfText } from "~/lib/pdf2img";
import { migrateResume } from "~/lib/migrations";
import { StorageUnavailableError } from "~/lib/storage/indexeddb";
import { notifyResumesChanged, withTabLock } from "~/lib/tabsync";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";
import KeywordTracker from "~/components/KeywordTracker";
import CoverLetterModal from "~/components/CoverLetterModal";
import CoverLetterButton from "~/components/CoverLetterButton";
import LanguageSelector from "~/components/LanguageSelector";
import ThemeToggle from "~/components/ThemeToggle";
import { useI18nStore } from "~/lib/i18n";
import { useDialog } from "~/lib/useDialog";
import type { Resume } from "~/domain/resume";
import { buildResumeHeader, computeAttachmentsStatus } from "~/domain/resume";

export const meta = () => [
    { title: "CVision AI | Detailed Resume Audit Report" },
    {
        name: "description",
        content: "Comprehensive ATS diagnosis, keyword gap analysis, and tailored recommendations.",
    },
];

type LoadState = "loading" | "ready" | "not-found" | "error" | "storage-error";

// Remounting on `id` resets every piece of local state (loading flag, preview
// URLs, cached data) without needing to re-initialize it inside an effect.
const Resume = () => {
    const { id } = useParams();
    return <ResumeView key={id ?? "missing"} />;
};

const ResumeView = () => {
    const { fs, kv } = useAppStore();
    const { t, language } = useI18nStore();
    const { id } = useParams();
    const navigate = useNavigate();

    const [imageUrl, setImageUrl] = useState("");
    const [resumeUrl, setResumeUrl] = useState("");
    const [resumeData, setResumeData] = useState<Resume | null>(null);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isCoverLetterOpen, setIsCoverLetterOpen] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [noTextWarning, setNoTextWarning] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const resumeUrlRef = useRef<string | null>(null);
    const imageUrlRef = useRef<string | null>(null);
    const loadSeqRef = useRef(0);
    const lastFocusLoadRef = useRef(0);

    const deleteDialogRef = useDialog(showDeleteConfirm, () => setShowDeleteConfirm(false));

    useEffect(() => {
        let cancelled = false;
        lastFocusLoadRef.current = Date.now();

        const loadResume = async () => {
            const seq = ++loadSeqRef.current;
            if (!id) {
                setLoadState("not-found");
                return;
            }
            try {
                // Try IndexedDB entity first (source of truth)
                let data: Resume | null = await getResumeEntity(id);

                if (cancelled || loadSeqRef.current !== seq) return;

                // Fallback to localStorage legacy record with verified atomic migration
                if (!data) {
                    const raw = await kv.get(`resume:${id}`);
                    if (cancelled || loadSeqRef.current !== seq) return;
                    if (!raw) {
                        setLoadState("not-found");
                        return;
                    }
                    try {
                        const rawObj = JSON.parse(raw);
                        const migrated = migrateResume(rawObj);
                        if (!migrated) {
                            setLoadState("error");
                            return;
                        }
                        const expectedVersion =
                            typeof rawObj.version === "number" ? rawObj.version : undefined;
                        // Entity + header must be written as one unit: another tab
                        // could otherwise observe a header without its entity.
                        const upgraded = await withTabLock(`resume-write-${id}`, async () => {
                            const saveRes = await saveResumeEntity(migrated, expectedVersion);
                            if (!saveRes.success && saveRes.reason === "storage_error") {
                                return null;
                            }
                            // On version_mismatch another tab already wrote a newer
                            // record; keep that one instead of clobbering it.
                            const entity = saveRes.entity;
                            await kv.set(`resume:${id}`, JSON.stringify(buildResumeHeader(entity)));
                            return entity;
                        });
                        if (!upgraded) {
                            setLoadState("error");
                            return;
                        }
                        data = upgraded;
                    } catch {
                        setLoadState("error");
                        return;
                    }
                }

                if (cancelled || loadSeqRef.current !== seq) return;

                const resumeBlob = await fs.read(data.resumePath);
                if (cancelled || loadSeqRef.current !== seq) return;

                let textWasExtracted = false;
                if (resumeBlob) {
                    const pdfBlob = new Blob([resumeBlob], { type: "application/pdf" });
                    const newResUrl = URL.createObjectURL(pdfBlob);
                    if (cancelled || loadSeqRef.current !== seq) {
                        URL.revokeObjectURL(newResUrl);
                        return;
                    }
                    if (resumeUrlRef.current) URL.revokeObjectURL(resumeUrlRef.current);
                    resumeUrlRef.current = newResUrl;
                    setResumeUrl(newResUrl);

                    if (!data.rawText) {
                        const pdfFile = new File([pdfBlob], "resume.pdf", {
                            type: "application/pdf",
                        });
                        const extracted = await extractPdfText(pdfFile);
                        if (cancelled || loadSeqRef.current !== seq) return;
                        data.rawText = extracted;
                        textWasExtracted = true;
                        if (!extracted.trim()) setNoTextWarning(true);
                    }
                } else {
                    if (resumeUrlRef.current) {
                        URL.revokeObjectURL(resumeUrlRef.current);
                        resumeUrlRef.current = null;
                    }
                    setResumeUrl("");
                }

                const imageBlob = await fs.read(data.imagePath);
                if (cancelled || loadSeqRef.current !== seq) return;

                if (imageBlob) {
                    const newImgUrl = URL.createObjectURL(imageBlob);
                    if (cancelled || loadSeqRef.current !== seq) {
                        URL.revokeObjectURL(newImgUrl);
                        return;
                    }
                    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
                    imageUrlRef.current = newImgUrl;
                    setImageUrl(newImgUrl);
                } else {
                    if (imageUrlRef.current) {
                        URL.revokeObjectURL(imageUrlRef.current);
                        imageUrlRef.current = null;
                    }
                    setImageUrl("");
                }

                const verifiedStatus = computeAttachmentsStatus(
                    Boolean(resumeBlob),
                    Boolean(imageBlob),
                );
                if (data.attachmentsStatus !== verifiedStatus || textWasExtracted) {
                    data.attachmentsStatus = verifiedStatus;
                    const entityToSave: Resume = data;
                    const previousVersion = entityToSave.version;
                    const updated = await withTabLock(`resume-write-${id}`, async () => {
                        const saveRes = await saveResumeEntity(entityToSave, previousVersion);
                        if (!saveRes.success && saveRes.reason === "storage_error") {
                            return null;
                        }
                        const entity = saveRes.entity;
                        await kv.set(`resume:${id}`, JSON.stringify(buildResumeHeader(entity)));
                        return entity;
                    });
                    if (updated) data = updated;
                }

                if (cancelled || loadSeqRef.current !== seq) return;
                setResumeData(data);
                setLoadState("ready");
            } catch (err) {
                if (!cancelled && loadSeqRef.current === seq) {
                    setLoadState(
                        err instanceof StorageUnavailableError ? "storage-error" : "error",
                    );
                }
            }
        };

        loadResume();

        const handleFocus = () => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastFocusLoadRef.current < 2000) return;
            lastFocusLoadRef.current = now;
            loadResume();
        };
        window.addEventListener("focus", handleFocus);

        return () => {
            cancelled = true;
            window.removeEventListener("focus", handleFocus);
            if (resumeUrlRef.current) {
                URL.revokeObjectURL(resumeUrlRef.current);
                resumeUrlRef.current = null;
            }
            if (imageUrlRef.current) {
                URL.revokeObjectURL(imageUrlRef.current);
                imageUrlRef.current = null;
            }
        };
    }, [id, fs, kv]);

    // Prefer the stored AI/heuristic result. Only recompute locally when the
    // record predates this behavior, is marked heuristic (so language switching
    // stays live), or has no stored score.
    const activeFeedback = useMemo(() => {
        if (!resumeData) return null;
        const saved = resumeData.feedback;
        const hasSaved = !!saved && typeof saved.overallScore === "number";
        // Only trust an explicitly AI-generated result; everything else (heuristic
        // or legacy/unknown) is regenerated deterministically for the current language.
        if (hasSaved && saved.source === "ai") return saved;
        return generateResumeFeedback(resumeData, language);
    }, [resumeData, language]);

    const handleDelete = async () => {
        if (!id) return;
        setDeleteError("");
        setIsDeleting(true);
        try {
            await withTabLock(`resume-write-${id}`, async () => {
                if (resumeData) {
                    if (resumeData.resumePath) await fs.delete(resumeData.resumePath);
                    if (resumeData.imagePath) await fs.delete(resumeData.imagePath);
                }
                const deletedEntity = await deleteResumeEntity(id);
                const deletedKV = await kv.delete(`resume:${id}`);
                if (!deletedEntity && !deletedKV) {
                    throw new Error(t.resume.deleteError);
                }
            });

            notifyResumesChanged({
                type: "resume-deleted",
                resumeId: id,
                updatedAt: Date.now(),
            });
            navigate("/");
        } catch (err) {
            console.error("Failed to delete resume:", err);
            setDeleteError(t.resume.deleteError);
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-[#080c14] text-slate-900 dark:text-slate-100 flex flex-col">
            {/* Top Navigation Bar */}
            <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs sm:text-sm font-semibold transition-colors"
                >
                    <span>←</span>
                    <span>{t.resume.backToHome}</span>
                </Link>

                {/* Right Actions */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <LanguageSelector />
                    <ThemeToggle />

                    {/* Generate Cover Letter Button */}
                    <CoverLetterButton
                        onClick={() => setIsCoverLetterOpen(true)}
                        className="secondary-button text-xs font-semibold py-1.5 px-3 hidden sm:inline-flex"
                    />

                    {/* Export PDF */}
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={loadState !== "ready"}
                        className="secondary-button text-xs font-semibold py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t.resume.exportPdf}
                    >
                        <span>🖨️</span>
                        <span>{t.resume.exportPdf}</span>
                    </button>

                    {/* Delete Button */}
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl transition-colors cursor-pointer"
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
                </div>
            </nav>

            {/* Delete Modal */}
            {showDeleteConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowDeleteConfirm(false);
                    }}
                >
                    <div
                        ref={deleteDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-dialog-title"
                        aria-describedby="delete-dialog-description"
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl font-bold">
                            ⚠️
                        </div>
                        <div>
                            <h3
                                id="delete-dialog-title"
                                className="text-lg font-bold text-slate-900 dark:text-white"
                            >
                                {t.resume.deleteConfirmTitle}
                            </h3>
                            <p
                                id="delete-dialog-description"
                                className="text-xs text-slate-500 dark:text-slate-400 mt-1"
                            >
                                {t.resume.deleteConfirmMessage}
                            </p>
                        </div>
                        {deleteError && (
                            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                                {deleteError}
                            </p>
                        )}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                data-autofocus
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="secondary-button flex-1 text-xs py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t.resume.cancelDelete}
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? t.resume.deleting : t.resume.confirmDelete}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cover Letter Modal (mounted only while open so the draft is
                generated fresh from the current feedback) */}
            {activeFeedback && isCoverLetterOpen && (
                <CoverLetterModal
                    isOpen={isCoverLetterOpen}
                    onClose={() => setIsCoverLetterOpen(false)}
                    companyName={resumeData?.companyName}
                    jobTitle={resumeData?.jobTitle}
                    jobDescription={resumeData?.jobDescription}
                    resumeText={resumeData?.rawText}
                    feedback={activeFeedback}
                />
            )}

            {/* Main Content Layout */}
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">
                {loadState === "loading" && (
                    <div className="glass-card p-12 text-center space-y-4">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-sm text-slate-500">{t.resume.loadingPreview}</p>
                    </div>
                )}

                {loadState === "not-found" && (
                    <div className="glass-card p-12 text-center max-w-md mx-auto space-y-4">
                        <span className="text-4xl">🔍</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {t.resume.reportNotFoundTitle}
                        </h2>
                        <p className="text-xs text-slate-500">{t.resume.reportNotFoundDesc}</p>
                        <Link to="/" className="primary-button text-sm py-2.5 px-5 inline-flex">
                            {t.resume.backToHome}
                        </Link>
                    </div>
                )}

                {loadState === "error" && (
                    <div className="glass-card p-12 text-center max-w-md mx-auto space-y-4">
                        <span className="text-4xl">⚠️</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {t.resume.reportErrorTitle}
                        </h2>
                        <p className="text-xs text-slate-500">{t.resume.reportErrorDesc}</p>
                        <Link to="/" className="primary-button text-sm py-2.5 px-5 inline-flex">
                            {t.resume.backToHome}
                        </Link>
                    </div>
                )}

                {loadState === "storage-error" && (
                    <div className="glass-card p-12 text-center max-w-md mx-auto space-y-4">
                        <span className="text-4xl">🗄️</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {t.resume.storageErrorTitle}
                        </h2>
                        <p className="text-xs text-slate-500">{t.resume.storageErrorDesc}</p>
                        <Link to="/" className="primary-button text-sm py-2.5 px-5 inline-flex">
                            {t.resume.backToHome}
                        </Link>
                    </div>
                )}

                {loadState === "ready" && resumeData && (
                    <>
                        {noTextWarning && (
                            <div
                                role="alert"
                                className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300"
                            >
                                {t.resume.scannedPdfWarning}
                            </div>
                        )}

                        {/* Meta Header */}
                        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
                            <div>
                                {resumeData.companyName && (
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                        {resumeData.companyName}
                                    </span>
                                )}
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                                    {resumeData.jobTitle || t.home.defaultResumeTitle}
                                </h1>
                            </div>

                            <div className="flex sm:hidden">
                                <CoverLetterButton
                                    onClick={() => setIsCoverLetterOpen(true)}
                                    className="secondary-button w-full text-xs justify-center"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* Left Column: PDF Preview (Sticky on desktop) */}
                            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
                                <div className="glass-card p-4 rounded-3xl overflow-hidden shadow-lg border border-slate-200/80 dark:border-slate-800/80">
                                    {imageUrl && resumeUrl ? (
                                        <div className="space-y-3">
                                            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                                                <a
                                                    href={resumeUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={t.resume.openPdfNewTab}
                                                >
                                                    <img
                                                        src={imageUrl}
                                                        alt={t.resume.previewTitle}
                                                        className="w-full h-auto max-h-[600px] object-contain hover:scale-101 transition-transform duration-200"
                                                    />
                                                </a>
                                            </div>
                                            <div className="flex items-center justify-between px-2 text-xs text-slate-500">
                                                <span>{t.resume.previewTitle}</span>
                                                <a
                                                    href={resumeUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                                                >
                                                    {t.resume.openPdfNewTab}
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-96 flex items-center justify-center text-slate-400 text-sm">
                                            {t.resume.loadingPreview}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Diagnostic & ATS Sections */}
                            <div className="lg:col-span-7 space-y-6">
                                {activeFeedback ? (
                                    <>
                                        {/* Overall Summary Gauge */}
                                        <Summary
                                            feedback={activeFeedback}
                                            analyzedAt={resumeData.analyzedAt}
                                        />

                                        {/* Keyword Gap Tracker */}
                                        {activeFeedback.keywords && (
                                            <KeywordTracker keywords={activeFeedback.keywords} />
                                        )}

                                        {/* ATS Breakdown */}
                                        <ATS
                                            score={
                                                activeFeedback.ATS.score ||
                                                activeFeedback.overallScore
                                            }
                                            suggestions={activeFeedback.ATS.tips || []}
                                        />

                                        {/* Detailed Category Reviews with Google XYZ formula suggestions */}
                                        <Details feedback={activeFeedback} />
                                    </>
                                ) : (
                                    <div className="glass-card p-12 text-center space-y-4">
                                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        <p className="text-sm text-slate-500">
                                            {t.resume.generatingDiagnosis}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
};

export default Resume;
