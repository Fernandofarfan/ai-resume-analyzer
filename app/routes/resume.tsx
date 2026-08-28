import { Link, useParams } from "react-router";
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
    const [imageUrl, setImageUrl] = useState("");
    const [resumeUrl, setResumeUrl] = useState("");
    const [feedback, setFeedback] = useState<Feedback | null>(null);

    useEffect(() => {
        const loadResume = async () => {
            const resume = await kv.get(`resume:${id}`);

            if (!resume) return;

            const data = JSON.parse(resume);

            const resumeBlob = await fs.read(data.resumePath);
            if (!resumeBlob) return;

            const pdfBlob = new Blob([resumeBlob], { type: "application/pdf" });
            const resUrl = URL.createObjectURL(pdfBlob);
            setResumeUrl(resUrl);

            const imageBlob = await fs.read(data.imagePath);
            if (!imageBlob) return;
            const imgUrl = URL.createObjectURL(imageBlob);
            setImageUrl(imgUrl);

            setFeedback(data.feedback);
        };

        loadResume();
    }, [id]);

    return (
        <main className="!pt-0 min-h-screen bg-gray-50/50">
            <nav className="resume-nav flex justify-between items-center px-6 py-4">
                <Link to="/" className="back-button flex items-center gap-2">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">
                        {t.resume.backToHome}
                    </span>
                </Link>

                <LanguageSelector />
            </nav>
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
