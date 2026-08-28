import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import ResumeCard from "~/components/ResumeCard";
import { useAppStore } from "~/lib/store";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { useI18nStore } from "~/lib/i18n";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Resumind | AI Resume Analyzer" },
        { name: "description", content: "Smart feedback for your dream job!" },
    ];
}

export default function Home() {
    const { kv, fs } = useAppStore();
    const { t } = useI18nStore();
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [loadingResumes, setLoadingResumes] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadResumes = async () => {
        setLoadingResumes(true);

        const storedResumes = (await kv.list("resume:*", true)) as KVItem[];

        const parsedResumes = storedResumes?.map((resume) =>
            JSON.parse(resume.value) as Resume
        );

        setResumes(parsedResumes || []);
        setLoadingResumes(false);
    };

    useEffect(() => {
        loadResumes();
    }, []);

    const handleDelete = async () => {
        if (!deletingId) return;
        const resume = await kv.get(`resume:${deletingId}`);
        if (resume) {
            const data = JSON.parse(resume);
            if (data.resumePath) await fs.delete(data.resumePath);
            if (data.imagePath) await fs.delete(data.imagePath);
        }
        await kv.delete(`resume:${deletingId}`);
        setDeletingId(null);
        loadResumes();
    };

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
            <Navbar />

            {/* Delete confirmation modal */}
            {deletingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 shadow-xl animate-in fade-in duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{t.resume.deleteConfirmTitle}</h3>
                        <p className="text-gray-600 mb-6">{t.resume.deleteConfirmMessage}</p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setDeletingId(null)}
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

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>{t.home.heroTitle}</h1>
                    {!loadingResumes && resumes?.length === 0 ? (
                        <h2>{t.home.noResumesTitle}</h2>
                    ) : (
                        <h2>{t.home.reviewResumesSub}</h2>
                    )}
                </div>
                {loadingResumes && (
                    <div className="flex flex-col items-center justify-center">
                        <img src="/images/resume-scan-2.gif" className="w-[200px]" alt="loading" />
                    </div>
                )}

                {!loadingResumes && resumes.length > 0 && (
                    <div className="resumes-section">
                        {resumes.map((resume) => (
                            <ResumeCard
                                key={resume.id}
                                resume={resume}
                                onDelete={(id) => setDeletingId(id)}
                            />
                        ))}
                    </div>
                )}

                {!loadingResumes && resumes?.length === 0 && (
                    <div className="flex flex-col items-center justify-center mt-10 gap-4">
                        <Link to="/upload" className="primary-button w-fit text-xl font-semibold">
                            {t.home.uploadFirstButton}
                        </Link>
                    </div>
                )}
            </section>
        </main>
    );
}
