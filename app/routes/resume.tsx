import { Link, useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useAppStore } from "~/lib/store";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";
import LanguageSelector from "~/components/LanguageSelector";
import { useI18nStore } from "~/lib/i18n";

export const meta = () => [
    { title: "Resumind | Resume Review" },
    { name: "description", content: "Detailed overview and ATS analysis of your resume" },
];

const Resume = () => {
    const { fs, kv } = useAppStore();
    const { t } = useI18nStore();
    const { id } = useParams();
    const navigate = useNavigate();
    const [imageUrl, setImageUrl] = useState("");
    const [resumeUrl, setResumeUrl] = useState("");
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        let resUrl: string | null = null;
        let imgUrl: string | null = null;

        const loadResume = async () => {
            const resume = await kv.get(`resume:${id}`);

            if (!resume) return;

            const data = JSON.parse(resume);

            const resumeBlob = await fs.read(data.resumePath);
            if (!resumeBlob) return;

            const pdfBlob = new Blob([resumeBlob], { type: "application/pdf" });
            resUrl = URL.createObjectURL(pdfBlob);
            setResumeUrl(resUrl);

            const imageBlob = await fs.read(data.imagePath);
            if (!imageBlob) return;
            imgUrl = URL.createObjectURL(imageBlob);
            setImageUrl(imgUrl);

            setFeedback(data.feedback);
        };

        loadResume();

        return () => {
            if (resUrl) URL.revokeObjectURL(resUrl);
            if (imgUrl) URL.revokeObjectURL(imgUrl);
        };
    }, [id]);

    const handleDelete = async () => {
        const resume = await kv.get(`resume:${id}`);
        if (resume) {
            const data = JSON.parse(resume);
            await fs.delete(data.resumePath);
            await fs.delete(data.imagePath);
        }
        await kv.delete(`resume:${id}`);
        navigate("/");
    };

    return (
        <main className="!pt-0 min-h-screen bg-gray-50/50">
            <nav className="resume-nav flex justify-between items-center px-6 py-4">
                <Link to="/" className="back-button flex items-center gap-2">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">
                        {t.resume.backToHome}
                    </span>
                </Link>

                <div className="flex items-center gap-3">
                    <LanguageSelector />
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full transition-all duration-200 cursor-pointer"
                        title={t.resume.deleteResume}
                    >
                        <img src="/icons/cross.svg" alt="delete" className="w-3 h-3" />
                        <span>{t.resume.deleteResume}</span>
                    </button>
                </div>
            </nav>

            {/* Delete confirmation modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 shadow-xl animate-in fade-in duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{t.resume.deleteConfirmTitle}</h3>
                        <p className="text-gray-600 mb-6">{t.resume.deleteConfirmMessage}</p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
                            >
                                {t.resume.cancelDelete}
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-full transition-colors cursor-pointer"
                            >
                                {t.resume.confirmDelete}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-row w-full max-lg:flex-col-reverse">
                <section className="feedback-section bg-[url('/images/bg-small.svg')] bg-cover h-[100vh] sticky top-0 items-center justify-center">
                    {imageUrl && resumeUrl && (
                        <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-w-xl:h-fit w-fit">
                            <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={imageUrl}
                                    className="w-full h-full object-contain rounded-2xl"
                                    title="resume"
                                    alt="Resume preview"
                                />
                            </a>
                        </div>
                    )}
                </section>
                <section className="feedback-section">
                    <h2 className="text-4xl !text-black font-bold mb-4">
                        {t.resume.reviewHeading}
                    </h2>
                    {feedback ? (
                        <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                            <Summary feedback={feedback} />
                            <ATS
                                score={feedback.ATS.score || 0}
                                suggestions={feedback.ATS.tips || []}
                            />
                            <Details feedback={feedback} />
                        </div>
                    ) : (
                        <img src="/images/resume-scan-2.gif" className="w-full max-w-md mx-auto" alt="loading" />
                    )}
                </section>
            </div>
        </main>
    );
};

export default Resume;
