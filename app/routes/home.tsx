import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import ResumeCard from "~/components/ResumeCard";
import {
    useAppStore,
    deleteResumeEntity,
    exportAllResumeData,
    importBackupData,
    encryptBackupData,
    decryptBackupData,
    isEncryptedBackup,
    InvalidPassphraseError,
} from "~/lib/store";
import { Link } from "react-router";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useI18nStore } from "~/lib/i18n";
import { useDialog } from "~/lib/useDialog";
import { useResumeList } from "~/lib/hooks/useResumeList";
import { migrateResumeHeader } from "~/lib/migrations";
import { notifyResumesChanged, withTabLock } from "~/lib/tabsync";
import { downloadBlob } from "~/lib/utils";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "CVision AI | Smart ATS Resume Analyzer & Optimizer" },
        {
            name: "description",
            content: "AI-powered resume audit, keyword matching, and ATS score optimization.",
        },
    ];
}

export default function Home() {
    const { kv, fs } = useAppStore();
    const { t } = useI18nStore();
    const { resumes, loadingResumes, storageInfo, loadResumes, commitResumes, resetResumes } =
        useResumeList();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [scoreFilter, setScoreFilter] = useState<"all" | "high" | "medium" | "low">("all");

    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importFeedback, setImportFeedback] = useState<{
        type: "success" | "warning" | "error";
        message: string;
    } | null>(null);
    const importFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Auto-dismiss the toast, keeping a single pending timer so it is always
    // cleared on unmount instead of firing against an unmounted component.
    const clearImportFeedbackLater = useCallback(() => {
        if (importFeedbackTimerRef.current) clearTimeout(importFeedbackTimerRef.current);
        importFeedbackTimerRef.current = setTimeout(() => setImportFeedback(null), 6000);
    }, []);

    // Encrypted Backup Modal State
    const [pendingEncryptedBackup, setPendingEncryptedBackup] = useState<unknown | null>(null);
    const [decryptPassword, setDecryptPassword] = useState("");
    const [decryptError, setDecryptError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isDecrypting, setIsDecrypting] = useState(false);

    const deleteDialogRef = useDialog(!!deletingId, () => setDeletingId(null));
    const decryptDialogRef = useDialog(!!pendingEncryptedBackup, () => {
        setPendingEncryptedBackup(null);
        setDecryptPassword("");
        setDecryptError("");
        setShowPassword(false);
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // The import toast timer lives outside the list hook, so it gets its own
    // unmount cleanup.
    useEffect(() => {
        return () => {
            if (importFeedbackTimerRef.current) clearTimeout(importFeedbackTimerRef.current);
        };
    }, []);

    const handleDelete = async () => {
        if (!deletingId) return;
        setDeleteError("");
        setIsDeleting(true);
        try {
            await withTabLock(`resume-write-${deletingId}`, async () => {
                const headerRaw = await kv.get(`resume:${deletingId}`);
                if (headerRaw) {
                    const header = migrateResumeHeader(JSON.parse(headerRaw));
                    if (header) {
                        if (header.resumePath) await fs.delete(header.resumePath);
                        if (header.imagePath) await fs.delete(header.imagePath);
                    }
                }
                const deletedEntity = await deleteResumeEntity(deletingId);
                const deletedKV = await kv.delete(`resume:${deletingId}`);
                if (!deletedEntity && !deletedKV) {
                    throw new Error(t.resume.deleteError);
                }
            });

            setDeletingId(null);
            resetResumes();
            notifyResumesChanged({
                type: "resume-deleted",
                resumeId: deletingId,
                updatedAt: Date.now(),
            });
            loadResumes().then(commitResumes);
        } catch (err) {
            console.error("Failed to delete resume:", err);
            setDeleteError(t.resume.deleteError);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExportBackup = async () => {
        setIsExporting(true);
        try {
            const data = await exportAllResumeData();
            const password = window.prompt(t.home.exportPasswordPrompt);

            let outputPayload: unknown = data;
            let filename = `cvision-backup-${new Date().toISOString().slice(0, 10)}.json`;

            if (password && password.trim()) {
                const trimmed = password.trim();
                if (trimmed.length < 6) {
                    setImportFeedback({
                        type: "error",
                        message: t.home.exportPasswordTooShort,
                    });
                    clearImportFeedbackLater();
                    return;
                }
                const confirmPassword = window.prompt(t.home.exportPasswordConfirm);
                if (confirmPassword !== trimmed) {
                    setImportFeedback({
                        type: "error",
                        message: t.home.exportPasswordMismatch,
                    });
                    clearImportFeedbackLater();
                    return;
                }
                outputPayload = await encryptBackupData(data, trimmed);
                filename = `cvision-backup-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
            }

            downloadBlob(
                new Blob([JSON.stringify(outputPayload, null, 2)], {
                    type: "application/json",
                }),
                filename,
            );
        } catch (err) {
            console.error("Backup export failed:", err);
            setImportFeedback({
                type: "error",
                message: t.home.importError.replace(
                    "{error}",
                    err instanceof Error ? err.message : String(err),
                ),
            });
            clearImportFeedbackLater();
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reject oversized files before reading entire payload into memory
        if (file.size > 55 * 1024 * 1024) {
            setImportFeedback({
                type: "error",
                message: t.home.importError.replace("{error}", "File exceeds maximum size of 55MB"),
            });
            clearImportFeedbackLater();
            return;
        }

        setIsImporting(true);
        setImportFeedback(null);
        if (importFeedbackTimerRef.current) clearTimeout(importFeedbackTimerRef.current);
        try {
            const text = await file.text();
            let json: unknown;
            try {
                json = JSON.parse(text);
            } catch {
                setImportFeedback({
                    type: "error",
                    message: t.home.importError.replace("{error}", "Invalid JSON"),
                });
                clearImportFeedbackLater();
                return;
            }

            if (isEncryptedBackup(json)) {
                setPendingEncryptedBackup(json);
                setDecryptPassword("");
                setDecryptError("");
                setShowPassword(false);
                return;
            }

            await executeImport(json);
        } catch (err) {
            console.error("Failed to import backup:", err);
            setImportFeedback({
                type: "error",
                message: t.home.importError.replace(
                    "{error}",
                    err instanceof Error ? err.message : String(err),
                ),
            });
            clearImportFeedbackLater();
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const executeImport = async (json: unknown) => {
        const res = await withTabLock("resume-import", async () => {
            return await importBackupData(json);
        });

        if (!res) {
            setImportFeedback({
                type: "error",
                message: "Import locked: another tab is currently importing a backup.",
            });
            return;
        }

        if (
            res.success &&
            res.skipped === 0 &&
            res.warnings.length === 0 &&
            res.errors.length === 0
        ) {
            setImportFeedback({
                type: "success",
                message: t.home.importSuccess.replace("{count}", String(res.restored)),
            });
            resetResumes();
            commitResumes(await loadResumes());
            notifyResumesChanged({ type: "resumes-changed" });
        } else if (res.restored > 0) {
            const detail =
                res.warnings.length > 0
                    ? ` (${res.warnings.length} notice${res.warnings.length > 1 ? "s" : ""})`
                    : "";
            setImportFeedback({
                type: "warning",
                message:
                    t.home.importPartial
                        .replace("{restored}", String(res.restored))
                        .replace("{skipped}", String(res.skipped)) + detail,
            });
            resetResumes();
            commitResumes(await loadResumes());
            notifyResumesChanged({ type: "resumes-changed" });
        } else {
            setImportFeedback({
                type: "error",
                message: t.home.importError.replace(
                    "{error}",
                    res.errors[0] || "No valid resumes found",
                ),
            });
        }
        clearImportFeedbackLater();
    };

    const handleConfirmDecrypt = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = decryptPassword.trim();
        if (!trimmed) {
            setDecryptError(t.home.importPasswordRequired);
            return;
        }
        setIsDecrypting(true);
        setDecryptError("");
        let decryptedJson: unknown;
        try {
            decryptedJson = await decryptBackupData(pendingEncryptedBackup, trimmed);
        } catch (decryptErr) {
            // Only decryption failures mean "wrong password / corrupt archive";
            // import failures below are reported through the normal toast.
            setDecryptError(
                decryptErr instanceof InvalidPassphraseError
                    ? t.home.importPasswordIncorrect
                    : t.home.importCorruptedArchive,
            );
            setIsDecrypting(false);
            return;
        }

        setPendingEncryptedBackup(null);
        setDecryptPassword("");
        setShowPassword(false);
        try {
            await executeImport(decryptedJson);
        } catch (err) {
            console.error("Failed to import decrypted backup:", err);
            setImportFeedback({
                type: "error",
                message: t.home.importError.replace(
                    "{error}",
                    err instanceof Error ? err.message : String(err),
                ),
            });
            clearImportFeedbackLater();
        } finally {
            setIsDecrypting(false);
        }
    };

    // Filtered Resumes with comprehensive searchSnippet and keywords matching
    const filteredResumes = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return resumes.filter((r) => {
            const matchesSearch =
                !q ||
                (r.companyName?.toLowerCase() || "").includes(q) ||
                (r.jobTitle?.toLowerCase() || "").includes(q) ||
                (r.searchSnippet?.toLowerCase() || "").includes(q) ||
                (r.matchingKeywords?.some((k) => k.toLowerCase().includes(q)) ?? false) ||
                (r.missingKeywords?.some((k) => k.toLowerCase().includes(q)) ?? false);

            const score = r.overallScore || 0;
            let matchesScore = true;
            if (scoreFilter === "high") matchesScore = score >= 80;
            if (scoreFilter === "medium") matchesScore = score >= 50 && score < 80;
            if (scoreFilter === "low") matchesScore = score < 50;

            return matchesSearch && matchesScore;
        });
    }, [resumes, searchQuery, scoreFilter]);

    return (
        <main className="min-h-screen bg-cyber-grid flex flex-col transition-colors duration-300">
            <Navbar />

            {/* Delete confirmation modal */}
            {deletingId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setDeletingId(null);
                    }}
                >
                    <div
                        ref={deleteDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="home-delete-dialog-title"
                        aria-describedby="home-delete-dialog-description"
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl font-bold">
                            ⚠️
                        </div>
                        <div>
                            <h3
                                id="home-delete-dialog-title"
                                className="text-lg font-bold text-slate-900 dark:text-white"
                            >
                                {t.resume.deleteConfirmTitle}
                            </h3>
                            <p
                                id="home-delete-dialog-description"
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
                                onClick={() => setDeletingId(null)}
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

            {/* Decrypt Password Modal */}
            {Boolean(pendingEncryptedBackup) && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isDecrypting)
                            setPendingEncryptedBackup(null);
                    }}
                >
                    <div
                        ref={decryptDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="home-decrypt-dialog-title"
                        aria-describedby="home-decrypt-dialog-description"
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl font-bold">
                                🔐
                            </div>
                            <div>
                                <h3
                                    id="home-decrypt-dialog-title"
                                    className="text-lg font-bold text-slate-900 dark:text-white"
                                >
                                    {t.home.importPasswordPrompt}
                                </h3>
                                <p
                                    id="home-decrypt-dialog-description"
                                    className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
                                >
                                    AES-GCM-256
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleConfirmDecrypt} className="space-y-4 pt-2">
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    data-autofocus
                                    value={decryptPassword}
                                    onChange={(e) => {
                                        setDecryptPassword(e.target.value);
                                        setDecryptError("");
                                    }}
                                    placeholder={t.home.passwordPlaceholder}
                                    disabled={isDecrypting}
                                    className="w-full px-4 py-3 pr-12 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? "👁️" : "🔒"}
                                </button>
                            </div>

                            {decryptError && (
                                <p
                                    role="alert"
                                    className="text-xs text-rose-600 dark:text-rose-400 font-medium"
                                >
                                    {decryptError}
                                </p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setPendingEncryptedBackup(null)}
                                    disabled={isDecrypting}
                                    className="secondary-button flex-1 text-xs py-2.5 disabled:opacity-50"
                                >
                                    {t.home.cancelButton}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isDecrypting || !decryptPassword.trim()}
                                    className="primary-button flex-1 text-xs py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDecrypting ? "..." : t.home.decryptButton}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Main Hero Container */}
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-16 space-y-12 flex-1">
                {/* Hero Section */}
                <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                        <span>✨</span>
                        <span>{t.home.badge}</span>
                    </div>

                    <h1 className="text-slate-900 dark:text-white">
                        <span className="block">{t.home.heroTitle.split("&")[0]}</span>
                        <span className="text-gradient dark:text-gradient">
                            {t.home.heroTitle.includes("&")
                                ? `& ${t.home.heroTitle.split("&")[1]}`
                                : ""}
                        </span>
                    </h1>

                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                        {t.home.heroSubtitle}
                    </p>

                    {/* Primary CTA */}
                    <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                        <Link
                            to="/upload"
                            className="primary-button text-sm sm:text-base py-3 px-8"
                        >
                            <span>🚀</span>
                            <span>{t.home.uploadFirstButton}</span>
                        </Link>
                    </div>
                </div>

                {importFeedback && (
                    <div
                        role="alert"
                        className={`max-w-md mx-auto p-3.5 rounded-2xl border text-xs font-semibold text-center animate-in fade-in ${
                            importFeedback.type === "success"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : importFeedback.type === "warning"
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                        }`}
                    >
                        <span>
                            {importFeedback.type === "success"
                                ? "✅ "
                                : importFeedback.type === "warning"
                                  ? "⚠️ "
                                  : "❌ "}
                        </span>
                        <span>{importFeedback.message}</span>
                    </div>
                )}

                {/* Filter and Search Bar */}
                {resumes.length > 0 && (
                    <div className="glass-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
                        {/* Search Input */}
                        <div className="relative w-full sm:w-80">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                🔍
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t.home.searchPlaceholder}
                                className="pl-10 text-xs sm:text-sm py-2.5 rounded-xl"
                            />
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                            {(["all", "high", "medium", "low"] as const).map((filterKey) => {
                                const labels = {
                                    all: t.home.filterAll,
                                    high: t.home.filterHigh,
                                    medium: t.home.filterMedium,
                                    low: t.home.filterLow,
                                };

                                return (
                                    <button
                                        key={filterKey}
                                        type="button"
                                        onClick={() => setScoreFilter(filterKey)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                            scoreFilter === filterKey
                                                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                    >
                                        {labels[filterKey]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Resumes Grid / Empty States */}
                {loadingResumes ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-600 animate-spin"></div>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                            {t.home.loadingResumes}
                        </p>
                    </div>
                ) : filteredResumes.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 px-2">
                            <span>
                                {filteredResumes.length} {t.home.resumesFound}
                            </span>
                            <div className="flex items-center gap-3">
                                {storageInfo && (
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                        💾{" "}
                                        {t.home.storageQuota
                                            .replace("{used}", storageInfo.usageMB)
                                            .replace("{quota}", storageInfo.quotaMB)
                                            .replace("{percent}", String(storageInfo.percentUsed))}
                                    </span>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        onChange={handleImportBackup}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isImporting}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <span>📥</span>
                                        <span>{isImporting ? "..." : t.home.importBackup}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportBackup}
                                        disabled={isExporting}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <span>📦</span>
                                        <span>{t.home.exportBackup}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6">
                            {filteredResumes.map((resume) => (
                                <ResumeCard
                                    key={resume.id}
                                    resume={resume}
                                    onDelete={(id) => setDeletingId(id)}
                                />
                            ))}
                        </div>
                    </div>
                ) : resumes.length > 0 ? (
                    <div className="glass-card p-12 text-center max-w-md mx-auto space-y-3">
                        <span className="text-4xl">🔍</span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {t.home.noResultsTitle}
                        </h3>
                        <p className="text-xs text-slate-500">{t.home.noResultsDesc}</p>
                    </div>
                ) : (
                    <div className="glass-card p-10 sm:p-16 text-center max-w-lg mx-auto space-y-6">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center text-2xl font-bold shadow-inner">
                            📄
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {t.home.noResumesTitle}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                {t.home.emptyStateDesc}
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <Link
                                to="/upload"
                                className="primary-button text-sm py-3 px-6 inline-flex"
                            >
                                {t.home.uploadFirstButton}
                            </Link>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleImportBackup}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isImporting}
                                className="secondary-button text-xs py-3 px-4 inline-flex items-center gap-1.5"
                            >
                                <span>📥</span>
                                <span>{isImporting ? "..." : t.home.importBackup}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
