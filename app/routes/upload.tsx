import { type FormEvent, useEffect, useRef, useState } from "react";
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {
    useAppStore,
    generateResumeFeedback,
    computeConfidence,
    extractProfileSignals,
    saveResumeEntity,
    getResumeEntity,
    deleteResumeEntity,
    estimateStorageQuota,
} from "~/lib/store";
import { useNavigate } from "react-router";
import { processPdf } from "~/lib/pdf2img";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions } from "../../constants";
import { useI18nStore } from "~/lib/i18n";
import { parseFeedbackText } from "~/lib/ai/schema";
import { fetchProviderConfig, ConsentRequiredError, UnauthorizedError } from "~/lib/ai/providers";
import { RESUME_SCHEMA_VERSION, EMPTY_FEEDBACK } from "~/lib/migrations";
import { notifyResumesChanged, withTabLock } from "~/lib/tabsync";
import type { Resume } from "~/domain/resume";
import { buildResumeHeader } from "~/domain/resume";

export const meta = () => [
    { title: "CVision AI | Upload & Analyze Resume" },
    {
        name: "description",
        content:
            "Upload your resume and job requirements for an instant ATS diagnosis and keyword match audit.",
    },
];

const Upload = () => {
    const { fs, ai, kv } = useAppStore();
    const { t, language } = useI18nStore();
    const navigate = useNavigate();

    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [errorText, setErrorText] = useState("");
    const [warningText, setWarningText] = useState("");
    const [progressStep, setProgressStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [fileKey, setFileKey] = useState(0);
    const [consentRequired, setConsentRequired] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const [requiresAuth, setRequiresAuth] = useState(false);
    const [apiKey, setApiKey] = useState(() => {
        try {
            if (typeof sessionStorage !== "undefined") {
                return sessionStorage.getItem("cvision_api_key") || "";
            }
        } catch {
            // Storage disabled
        }
        return "";
    });
    const [configLoaded, setConfigLoaded] = useState(false);
    const [providerMode, setProviderMode] = useState<
        "offline" | "gemini" | "groq" | "ollama" | "unknown"
    >("offline");
    const [providerStatus, setProviderStatus] = useState<
        "ready" | "offline" | "server-unavailable"
    >("offline");

    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        let mounted = true;
        fetchProviderConfig().then((cfg) => {
            if (mounted) {
                setConsentRequired(cfg.requiresConsent);
                setRequiresAuth(cfg.requiresAuth === true);
                const validModes: Record<string, "offline" | "gemini" | "groq" | "ollama"> = {
                    offline: "offline",
                    gemini: "gemini",
                    groq: "groq",
                    ollama: "ollama",
                };
                setProviderMode(validModes[cfg.provider] || "unknown");
                setProviderStatus(cfg.status);
                setConfigLoaded(true);
            }
        });
        return () => {
            mounted = false;
            abortRef.current?.abort();
        };
    }, []);

    const handleFileSelect = (selected: File | null) => {
        setFile(selected);
        setErrorText("");
        setWarningText("");
        setFileKey((k) => k + 1);
    };

    const cleanupBlobs = async (paths: string[]) => {
        for (const p of paths) {
            try {
                await fs.delete(p);
            } catch {
                // Ignore cleanup errors
            }
        }
    };

    const handleCancel = () => {
        abortRef.current?.abort();
        setIsProcessing(false);
        setStatusText("");
        setProgressStep(1);
        setErrorText("");
    };

    const canSubmit =
        !!file && !isProcessing && configLoaded && (!consentRequired || consentChecked);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorText("");
        setWarningText("");

        if (!file) return;
        if (consentRequired && !consentChecked) {
            setErrorText(t.upload.errorConsent);
            return;
        }

        // Check available storage before processing
        const quota = await estimateStorageQuota();
        if (quota && quota.quotaBytes > 0) {
            const freeBytes = quota.quotaBytes - quota.usageBytes;
            if (freeBytes < 15 * 1024 * 1024 || quota.percentUsed >= 98) {
                setErrorText(t.upload.errorStorageQuota);
                return;
            }
        }

        const form = e.currentTarget;
        const formData = new FormData(form);
        const jobTitle = ((formData.get("job-title") as string) || "").trim();
        const jobDescription = ((formData.get("job-description") as string) || "").trim();
        const companyName = ((formData.get("company-name") as string) || "").trim();

        const controller = new AbortController();
        abortRef.current = controller;
        const signal = controller.signal;

        setIsProcessing(true);
        setStatusText(t.upload.statusUploading);
        setProgressStep(1);

        const createdPaths: string[] = [];
        let resumeId: string | null = null;
        let resumeKey: string | null = null;
        let completed = false;
        let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

        try {
            const uuid = generateUUID();
            resumeId = uuid;
            resumeKey = `resume:${uuid}`;

            const uploadedFile = await fs.upload([file]);
            if (!uploadedFile) {
                throw new Error(t.upload.errorUploadFile);
            }
            createdPaths.push(uploadedFile.path);

            if (signal.aborted) return;

            const initialEntity: Resume = {
                id: uuid,
                schemaVersion: RESUME_SCHEMA_VERSION,
                jobTitle,
                companyName,
                jobDescription,
                resumePath: uploadedFile.path,
                imagePath: "",
                rawText: "",
                status: "processing",
                processingStartedAt: Date.now(),
                heartbeatAt: Date.now(),
                updatedAt: Date.now(),
                feedback: { ...EMPTY_FEEDBACK },
            };

            const initialRes = await saveResumeEntity(initialEntity);
            if (!initialRes.success) {
                throw new Error(t.upload.errorSave || "Failed to save initial resume state");
            }
            heartbeatInterval = setInterval(async () => {
                try {
                    await withTabLock(`resume-write-${uuid}`, async () => {
                        const current = await getResumeEntity(uuid);
                        if (current && current.status === "processing") {
                            await saveResumeEntity({
                                ...current,
                                heartbeatAt: Date.now(),
                                updatedAt: Date.now(),
                            });
                        }
                    });
                } catch {
                    // Ignore transient heartbeat save errors
                }
            }, 5000);

            if (signal.aborted) return;

            setStatusText(t.upload.statusConverting);
            setProgressStep(2);

            const {
                text: resumeText,
                image: imageFile,
                noText,
                hasMultipleColumns,
                error: pdfError,
            } = await processPdf(file, signal);
            if (signal.aborted) return;
            if (pdfError) {
                throw new Error(t.upload.errorConvertPdf);
            }
            if (noText) {
                throw new Error(t.upload.scannedPdfError);
            }
            if (hasMultipleColumns) {
                setWarningText(t.upload.columnsWarning);
            }

            if (signal.aborted) return;

            let imagePath = "";
            if (imageFile) {
                setStatusText(t.upload.statusUploadingImage);
                const uploadedImage = await fs.upload([imageFile]);
                if (uploadedImage) {
                    imagePath = uploadedImage.path;
                    createdPaths.push(imagePath);
                }
            }

            if (signal.aborted) return;

            setStatusText(t.upload.statusPreparing);
            setProgressStep(3);

            const prompt = prepareInstructions({ resumeText, jobTitle, jobDescription, language });

            setStatusText(t.upload.statusAnalyzing);
            setProgressStep(4);

            let feedback;
            let fallbackOccurred = false;

            if (providerStatus === "server-unavailable" || providerMode === "offline") {
                const fallbackAnalysis = generateResumeFeedback(
                    { rawText: resumeText, jobTitle, jobDescription },
                    language,
                );
                feedback = {
                    message: { content: JSON.stringify(fallbackAnalysis) },
                    source: "heuristic" as const,
                    fallbackReason:
                        providerStatus === "server-unavailable"
                            ? ("offline-mode" as const)
                            : undefined,
                };
            } else {
                try {
                    feedback = await ai.feedback(prompt, consentChecked, signal);
                    if (!feedback || !feedback.message?.content) {
                        fallbackOccurred = true;
                    }
                } catch (aiErr) {
                    if (signal.aborted) throw aiErr;
                    if (aiErr instanceof ConsentRequiredError || aiErr instanceof UnauthorizedError)
                        throw aiErr;
                    console.warn("ai.feedback failed, falling back to local:", aiErr);
                    fallbackOccurred = true;
                }
            }

            if (signal.aborted) return;

            const feedbackText =
                typeof feedback?.message?.content === "string" ? feedback.message.content : "";

            const data: Resume = {
                id: uuid,
                schemaVersion: RESUME_SCHEMA_VERSION,
                analyzedAt: Date.now(),
                updatedAt: Date.now(),
                resumePath: uploadedFile.path,
                imagePath,
                jobTitle,
                companyName,
                jobDescription,
                rawText: resumeText,
                status: "completed",
                version: 1,
                feedback: { ...EMPTY_FEEDBACK },
            };

            const parsed = parseFeedbackText(feedbackText);
            const wordCount = resumeText ? resumeText.split(/\s+/).filter(Boolean).length : 0;
            const signals = extractProfileSignals(resumeText);

            if (parsed) {
                data.feedback = {
                    ...parsed,
                    source: feedback?.source ?? "heuristic",
                    fallbackReason: feedback?.fallbackReason,
                    confidence: computeConfidence({
                        wordCount,
                        targetKeywordCount:
                            (parsed.keywords?.matching?.length ?? 0) +
                            (parsed.keywords?.missing?.length ?? 0),
                        hasJobDescription: !!jobDescription.trim(),
                        metricCount: signals.quantifiedAchievements,
                        hasResumeText: !!resumeText,
                    }),
                };
            } else {
                data.feedback = {
                    ...generateResumeFeedback(
                        { rawText: resumeText, jobTitle, jobDescription },
                        language,
                    ),
                    fallbackReason:
                        fallbackOccurred || feedback?.fallbackReason
                            ? "provider-fallback"
                            : undefined,
                };
                if (feedback?.source === "ai") {
                    setWarningText(t.upload.warningInvalidAI);
                }
            }

            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }

            if (signal.aborted) return;

            // Commit entity + list header under a per-resume mutex so no other
            // tab can interleave between the two writes.
            const finalKey = resumeKey;
            if (!finalKey) {
                throw new Error(t.upload.errorSave || "Failed to persist completed analysis");
            }
            const finalSavedEntity = await withTabLock(`resume-write-${uuid}`, async () => {
                const commit = async () => {
                    const current = await getResumeEntity(uuid);
                    // Adopt the freshest version/updatedAt as the optimistic
                    // baseline so heartbeat writes never look like stale writes.
                    const baseline = current
                        ? {
                              ...data,
                              version: current.version,
                              updatedAt: Math.max(data.updatedAt ?? 0, current.updatedAt ?? 0),
                          }
                        : data;
                    return await saveResumeEntity(baseline, current?.version);
                };

                let saveRes = await commit();
                // Only reachable when a writer bypassed the mutex; retry once
                // against the version it observed.
                if (!saveRes.success && saveRes.reason === "version_mismatch") {
                    saveRes = await commit();
                }
                if (!saveRes.success) {
                    throw new Error(t.upload.errorSave || "Failed to persist completed analysis");
                }
                await kv.set(finalKey, JSON.stringify(buildResumeHeader(saveRes.entity)));
                return saveRes.entity;
            });

            completed = true;
            setStatusText(t.upload.statusComplete);
            notifyResumesChanged({
                type: "resumes-changed",
                resumeId: uuid,
                version: finalSavedEntity.version,
                updatedAt: finalSavedEntity.updatedAt,
            });
            navigate(`/resume/${uuid}`);
        } catch (err) {
            if (abortRef.current !== controller) return;

            if (err instanceof Error && err.name === "AbortError") {
                setStatusText("");
                setProgressStep(1);
            } else {
                console.error("Analysis failed:", err);
                const message =
                    err instanceof UnauthorizedError
                        ? t.upload.errorUnauthorized
                        : err instanceof ConsentRequiredError
                          ? t.upload.errorConsent
                          : err instanceof Error
                            ? err.message
                            : t.upload.errorAnalyze;
                setErrorText(message);
                setStatusText("");
            }
        } finally {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (!completed) {
                await cleanupBlobs(createdPaths);
                if (resumeId) {
                    await deleteResumeEntity(resumeId);
                }
                if (resumeKey) {
                    await kv.delete(resumeKey);
                }
            }
            if (abortRef.current === controller) {
                setIsProcessing(false);
            }
        }
    };

    const modeText = (() => {
        switch (providerMode) {
            case "gemini":
                return t.upload.modeRemote.replace("{provider}", "Google Gemini");
            case "groq":
                return t.upload.modeRemote.replace("{provider}", "Groq");
            case "ollama":
                return t.upload.modeOllama;
            case "offline":
                return t.upload.modeLocal;
            default:
                return t.upload.modeUnknown;
        }
    })();
    const modeIcon =
        providerMode === "offline" || providerMode === "ollama"
            ? "🔒"
            : providerMode === "unknown"
              ? "⚠️"
              : "🌐";

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
            <Navbar />

            <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Header */}
                <div className="text-center space-y-3 mb-8 sm:mb-12">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                        <span>⚡</span>
                        <span>{t.upload.badge}</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        {t.upload.heading}
                    </h1>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                        {t.upload.subheading}
                    </p>

                    {/* Active Provider Indicator */}
                    {configLoaded && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                            <span aria-hidden="true">{modeIcon}</span>
                            <span>{modeText}</span>
                        </div>
                    )}
                </div>

                {/* Progress / Form Card */}
                {isProcessing ? (
                    <div className="glass-card p-8 sm:p-12 text-center space-y-6 max-w-lg mx-auto">
                        <div className="relative w-16 h-16 mx-auto">
                            <div className="w-16 h-16 rounded-full border-4 border-indigo-200 dark:border-indigo-900/50 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
                            <span className="absolute inset-0 flex items-center justify-center text-xl">
                                {progressStep === 1
                                    ? "📄"
                                    : progressStep === 2
                                      ? "🖼️"
                                      : progressStep === 3
                                        ? "⚙️"
                                        : "✨"}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">{statusText}</h3>
                            <p className="text-xs text-slate-400">
                                {t.upload.stepProgress.replace("{step}", String(progressStep))}
                            </p>
                        </div>

                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${(progressStep / 4) * 100}%` }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleCancel}
                            className="secondary-button text-xs font-semibold py-2 px-5"
                        >
                            {t.upload.cancelButton}
                        </button>
                    </div>
                ) : (
                    <div className="glass-card p-6 sm:p-10 shadow-xl max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* File Uploader */}
                            <div className="space-y-2 w-full">
                                <label className="text-sm font-bold">
                                    <span>📄</span> {t.upload.uploadResumeLabel}
                                </label>
                                <FileUploader
                                    key={fileKey}
                                    file={file}
                                    onFileSelect={handleFileSelect}
                                />
                            </div>

                            {/* Job Title and Company Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                <div className="space-y-2">
                                    <label htmlFor="job-title">
                                        <span>💼</span> {t.upload.jobTitleLabel}
                                    </label>
                                    <input
                                        type="text"
                                        name="job-title"
                                        id="job-title"
                                        maxLength={120}
                                        placeholder={t.upload.jobTitlePlaceholder}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="company-name">
                                        <span>🏢</span> {t.upload.companyNameLabel}
                                    </label>
                                    <input
                                        type="text"
                                        name="company-name"
                                        id="company-name"
                                        maxLength={120}
                                        placeholder={t.upload.companyNamePlaceholder}
                                    />
                                </div>
                            </div>

                            {/* Job Description */}
                            <div className="space-y-2 w-full">
                                <label htmlFor="job-description">
                                    <span>🎯</span> {t.upload.jobDescriptionLabel}
                                </label>
                                <textarea
                                    rows={5}
                                    name="job-description"
                                    id="job-description"
                                    maxLength={10000}
                                    placeholder={t.upload.jobDescriptionPlaceholder}
                                />
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    💡 <em>{t.upload.jobDescTip}</em>
                                </p>
                            </div>

                            {/* API Token input when server requires auth */}
                            {requiresAuth && (
                                <div className="space-y-2 w-full p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
                                    <label
                                        htmlFor="api-key"
                                        className="text-xs font-bold text-slate-700 dark:text-slate-300"
                                    >
                                        <span>🔑</span> {t.upload.apiKeyLabel}
                                    </label>
                                    <input
                                        type="password"
                                        name="api-key"
                                        id="api-key"
                                        value={apiKey}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setApiKey(val);
                                            try {
                                                if (typeof sessionStorage !== "undefined") {
                                                    sessionStorage.setItem(
                                                        "cvision_api_key",
                                                        val.trim(),
                                                    );
                                                }
                                            } catch {
                                                // Storage disabled
                                            }
                                        }}
                                        placeholder={t.upload.apiKeyPlaceholder}
                                        className="w-full text-xs font-mono py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3"
                                    />
                                </div>
                            )}

                            {/* Server unavailable note (informational fallback) */}
                            {configLoaded && providerStatus === "server-unavailable" && (
                                <div
                                    role="status"
                                    className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2"
                                >
                                    <span>🔒</span>
                                    <span>{t.upload.modeServerUnavailable}</span>
                                </div>
                            )}

                            {/* Privacy consent for remote providers */}
                            {consentRequired && (
                                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={consentChecked}
                                        onChange={(e) => setConsentChecked(e.target.checked)}
                                        className="mt-0.5 h-4 w-4 accent-indigo-600"
                                    />
                                    <span>{t.upload.privacyConsent}</span>
                                </label>
                            )}

                            {/* Warning banner (non-blocking) */}
                            {warningText && (
                                <div
                                    role="status"
                                    className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300"
                                >
                                    {warningText}
                                </div>
                            )}

                            {/* Error banner */}
                            {errorText && (
                                <div
                                    role="alert"
                                    className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-600 dark:text-rose-300"
                                >
                                    {errorText}
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="pt-2 w-full">
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="primary-button w-full text-base py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>🚀</span>
                                    <span>{t.upload.analyzeButton}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </main>
    );
};

export default Upload;
