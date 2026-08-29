import { Link, useParams, useNavigate } from "react-router";
import { useEffect, useState, useMemo } from "react";
import { useAppStore, generateResumeFeedback } from "~/lib/store";
import { extractTextFromPdf } from "~/lib/pdf2img";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";
import KeywordTracker from "~/components/KeywordTracker";
import CoverLetterModal from "~/components/CoverLetterModal";
import LanguageSelector from "~/components/LanguageSelector";
import ThemeToggle from "~/components/ThemeToggle";
import { useI18nStore } from "~/lib/i18n";

export const meta = () => [
    { title: "CVision AI | Detailed Resume Audit Report" },
    { name: "description", content: "Comprehensive ATS diagnosis, keyword gap analysis, and tailored recommendations." },
];

const Resume = () => {
    const { fs, kv } = useAppStore();
    const { t, language } = useI18nStore();
    const { id } = useParams();
    const navigate = useNavigate();

    const [imageUrl, setImageUrl] = useState("");
    const [resumeUrl, setResumeUrl] = useState("");
    const [resumeData, setResumeData] = useState<Resume | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isCoverLetterOpen, setIsCoverLetterOpen] = useState(false);

    useEffect(() => {
        let resUrl: string | null = null;
        let imgUrl: string | null = null;

        const loadResume = async () => {
            const raw = await kv.get(`resume:${id}`);
            if (!raw) return;

            const data: Resume = JSON.parse(raw);

            const resumeBlob = await fs.read(data.resumePath);
            if (resumeBlob) {
                const pdfBlob = new Blob([resumeBlob], { type: "application/pdf" });
                resUrl = URL.createObjectURL(pdfBlob);
                setResumeUrl(resUrl);

                // If rawText wasn't stored, extract it now
                if (!data.rawText) {
                    const pdfFile = new File([pdfBlob], "resume.pdf", { type: "application/pdf" });
                    const extracted = await extractTextFromPdf(pdfFile);
                    data.rawText = extracted;
                    await kv.set(`resume:${id}`, JSON.stringify(data));
                }
            }

            const imageBlob = await fs.read(data.imagePath);
            if (imageBlob) {
                imgUrl = URL.createObjectURL(imageBlob);
                setImageUrl(imgUrl);
            }

            setResumeData(data);
        };

        loadResume();

        return () => {
            if (resUrl) URL.revokeObjectURL(resUrl);
            if (imgUrl) URL.revokeObjectURL(imgUrl);
        };
    }, [id]);

    // Compute feedback dynamically in the current active language (ES or EN)
    const activeFeedback = useMemo(() => {
        if (!resumeData) return null;
        return generateResumeFeedback(resumeData, language);
    }, [resumeData, language]);

    const handleDelete = async () => {
        if (resumeData) {
            if (resumeData.resumePath) await fs.delete(resumeData.resumePath);
            if (resumeData.imagePath) await fs.delete(resumeData.imagePath);
        }
        await kv.delete(`resume:${id}`);
        navigate("/");
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
                    <button
                        type="button"
                        onClick={() => setIsCoverLetterOpen(true)}
                        className="secondary-button text-xs font-semibold py-1.5 px-3 hidden sm:inline-flex"
                        title={t.resume.coverLetterBtn}
                    >
                        <span>✉️</span>
                        <span>{t.resume.coverLetterBtn}</span>
                    </button>

                    {/* Export PDF */}
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="secondary-button text-xs font-semibold py-1.5 px-3"
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
                        title={t.resume.deleteResume}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </nav>

            {/* Delete Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl font-bold">
                            ⚠️
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t.resume.deleteConfirmTitle}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {t.resume.deleteConfirmMessage}
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="secondary-button flex-1 text-xs py-2.5"
                            >
                                {t.resume.cancelDelete}
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors cursor-pointer"
                            >
                                {t.resume.confirmDelete}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cover Letter Modal */}
            {activeFeedback && (
                <CoverLetterModal
                    isOpen={isCoverLetterOpen}
                    onClose={() => setIsCoverLetterOpen(false)}
                    companyName={resumeData?.companyName}
                    jobTitle={resumeData?.jobTitle}
                    jobDescription={resumeData?.jobDescription}
                    feedback={activeFeedback}
                />
            )}

            {/* Main Content Layout */}
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">
                {/* Meta Header */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
                    <div>
                        {resumeData?.companyName && (
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                {resumeData.companyName}
                            </span>
                        )}
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                            {resumeData?.jobTitle || t.home.defaultResumeTitle}
                        </h1>
                    </div>

                    <div className="flex sm:hidden">
                        <button
                            type="button"
                            onClick={() => setIsCoverLetterOpen(true)}
                            className="secondary-button w-full text-xs"
                        >
                            <span>✉️</span>
                            <span>{t.resume.coverLetterBtn}</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: PDF Preview (Sticky on desktop) */}
                    <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
                        <div className="glass-card p-4 rounded-3xl overflow-hidden shadow-lg border border-slate-200/80 dark:border-slate-800/80">
                            {imageUrl && resumeUrl ? (
                                <div className="space-y-3">
                                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                                        <a href={resumeUrl} target="_blank" rel="noopener noreferrer" title={t.resume.openPdfNewTab}>
                                            <img
                                                src={imageUrl}
                                                alt="Preview"
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
                                <Summary feedback={activeFeedback} />

                                {/* Keyword Gap Tracker */}
                                {activeFeedback.keywords && (
                                    <KeywordTracker keywords={activeFeedback.keywords} />
                                )}

                                {/* ATS Breakdown */}
                                <ATS
                                    score={activeFeedback.ATS.score || activeFeedback.overallScore}
                                    suggestions={activeFeedback.ATS.tips || []}
                                />

                                {/* Detailed Category Reviews with Google XYZ formula suggestions */}
                                <Details feedback={activeFeedback} />
                            </>
                        ) : (
                            <div className="glass-card p-12 text-center space-y-4">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="text-sm text-slate-500">{t.resume.generatingDiagnosis}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Resume;
