import { type FormEvent, useState } from "react";
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import { useAppStore } from "~/lib/store";
import { useNavigate } from "react-router";
import { convertPdfToImage, extractTextFromPdf } from "~/lib/pdf2img";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions } from "../../constants";
import { useI18nStore } from "~/lib/i18n";

export const meta = () => [
    { title: "CVision AI | Upload & Analyze Resume" },
    { name: "description", content: "Upload your resume and job requirements for an instant ATS diagnosis and keyword match audit." },
];

const Upload = () => {
    const { fs, ai, kv } = useAppStore();
    const { t, language } = useI18nStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [progressStep, setProgressStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file);
    };

    const handleAnalyze = async ({
        companyName,
        jobTitle,
        jobDescription,
        file,
    }: {
        companyName: string;
        jobTitle: string;
        jobDescription: string;
        file: File;
    }) => {
        setIsProcessing(true);
        setProgressStep(1);

        try {
            setStatusText(t.upload.statusUploading);
            const uploadedFile = await fs.upload([file]);
            if (!uploadedFile) {
                setStatusText(t.upload.errorUploadFile);
                setIsProcessing(false);
                return;
            }

            setProgressStep(2);
            setStatusText(t.upload.statusConverting);
            const imageFile = await convertPdfToImage(file);
            if (!imageFile.file) {
                setStatusText(t.upload.errorConvertPdf);
                setIsProcessing(false);
                return;
            }

            setProgressStep(3);
            setStatusText(t.upload.statusUploadingImage);
            const resumeText = await extractTextFromPdf(file);

            const uploadedImage = await fs.upload([imageFile.file]);
            if (!uploadedImage) {
                setStatusText(t.upload.errorUploadImage);
                setIsProcessing(false);
                return;
            }

            setProgressStep(4);
            setStatusText(t.upload.statusPreparing);
            const uuid = generateUUID();
            const data: Resume = {
                id: uuid,
                resumePath: uploadedFile.path,
                imagePath: uploadedImage.path,
                companyName,
                jobTitle,
                jobDescription,
                rawText: resumeText,
                feedback: {} as Feedback,
            };
            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            setProgressStep(5);
            setStatusText(t.upload.statusAnalyzing);

            const feedback = await ai.feedback(
                uploadedFile.path,
                prepareInstructions({ jobTitle, jobDescription, language, resumeText })
            );
            if (!feedback) {
                setStatusText(t.upload.errorAnalyze);
                setIsProcessing(false);
                return;
            }

            const feedbackText =
                typeof feedback.message.content === "string"
                    ? feedback.message.content
                    : feedback.message.content[0].text;

            try {
                data.feedback = JSON.parse(feedbackText);
            } catch {
                data.feedback = feedbackText as any;
            }

            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setStatusText(t.upload.statusComplete);
            navigate(`/resume/${uuid}`);
        } catch (err) {
            console.error("Analysis failed:", err);
            setStatusText(t.upload.errorAnalyze);
            setIsProcessing(false);
        }
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest("form");
        if (!form) return;
        const formData = new FormData(form);

        const companyName = (formData.get("company-name") as string) || "";
        const jobTitle = (formData.get("job-title") as string) || "";
        const jobDescription = (formData.get("job-description") as string) || "";

        if (!file) return;

        handleAnalyze({ companyName, jobTitle, jobDescription, file });
    };

    return (
        <main className="min-h-screen bg-cyber-grid dark:bg-cyber-grid flex flex-col">
            <Navbar />

            <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-16 space-y-8 flex-1">
                {/* Header */}
                <div className="text-center space-y-3 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                        <span>⚡</span>
                        <span>Auditoría de Compatibilidad</span>
                    </div>
                    <h1 className="text-slate-900 dark:text-white">
                        {t.upload.heading}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        {t.upload.subheading}
                    </p>
                </div>

                {/* Form or Processing View */}
                {isProcessing ? (
                    <div className="glass-card p-10 sm:p-16 text-center space-y-8 max-w-lg mx-auto animate-in fade-in duration-300">
                        {/* Glowing Spinner */}
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                            <div className="absolute inset-3 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin animate-reverse"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-xl">
                                📄
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {statusText}
                            </h2>
                            <p className="text-xs text-slate-400">
                                Paso {progressStep} de 5 • Procesando datos
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500 rounded-full"
                                style={{ width: `${(progressStep / 5) * 100}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-6 sm:p-10 shadow-xl max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* File Uploader */}
                            <div className="space-y-2 w-full">
                                <label className="text-sm font-bold">
                                    <span>📄</span> {t.upload.uploadResumeLabel}
                                </label>
                                <FileUploader onFileSelect={handleFileSelect} />
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
                                    placeholder={t.upload.jobDescriptionPlaceholder}
                                />
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    💡 <em>Pegar los requisitos del puesto permite auditar palabras clave faltantes y evaluar tu compatibilidad exacta.</em>
                                </p>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-2 w-full">
                                <button
                                    type="submit"
                                    disabled={!file}
                                    className="primary-button w-full text-base py-3.5"
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
