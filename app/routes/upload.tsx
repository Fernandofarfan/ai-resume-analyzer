import { type FormEvent, useState } from "react";
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import { useAppStore } from "~/lib/store";
import { useNavigate } from "react-router";
import { convertPdfToImage } from "~/lib/pdf2img";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions } from "../../constants";
import { useI18nStore } from "~/lib/i18n";

export const meta = () => [
    { title: "Resumind | Upload & Analyze" },
    { name: "description", content: "Drop your resume for an ATS score and improvement tips" },
];

const Upload = () => {
    const { fs, ai, kv } = useAppStore();
    const { t, language } = useI18nStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState("");
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

        setStatusText(t.upload.statusUploading);
        const uploadedFile = await fs.upload([file]);
        if (!uploadedFile) return setStatusText(t.upload.errorUploadFile);

        setStatusText(t.upload.statusConverting);
        const imageFile = await convertPdfToImage(file);
        if (!imageFile.file) return setStatusText(t.upload.errorConvertPdf);

        setStatusText(t.upload.statusUploadingImage);
        const uploadedImage = await fs.upload([imageFile.file]);
        if (!uploadedImage) return setStatusText(t.upload.errorUploadImage);

        setStatusText(t.upload.statusPreparing);
        const uuid = generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName,
            jobTitle,
            jobDescription,
            feedback: "",
        };
        await kv.set(`resume:${uuid}`, JSON.stringify(data));

        setStatusText(t.upload.statusAnalyzing);

        const feedback = await ai.feedback(
            uploadedFile.path,
            prepareInstructions({ jobTitle, jobDescription, language })
        );
        if (!feedback) return setStatusText(t.upload.errorAnalyze);

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
        <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>{t.upload.heading}</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full max-w-md mx-auto" alt="scanning" />
                        </>
                    ) : (
                        <h2>{t.upload.subheading}</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">{t.upload.companyNameLabel}</label>
                                <input
                                    type="text"
                                    name="company-name"
                                    placeholder={t.upload.companyNamePlaceholder}
                                    id="company-name"
                                />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">{t.upload.jobTitleLabel}</label>
                                <input
                                    type="text"
                                    name="job-title"
                                    placeholder={t.upload.jobTitlePlaceholder}
                                    id="job-title"
                                />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">{t.upload.jobDescriptionLabel}</label>
                                <textarea
                                    rows={5}
                                    name="job-description"
                                    placeholder={t.upload.jobDescriptionPlaceholder}
                                    id="job-description"
                                />
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader">{t.upload.uploadResumeLabel}</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>

                            <button className="primary-button" type="submit" disabled={!file}>
                                {t.upload.analyzeButton}
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    );
};

export default Upload;
