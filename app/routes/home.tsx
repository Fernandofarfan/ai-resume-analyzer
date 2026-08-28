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
    const { kv } = useAppStore();
    const { t } = useI18nStore();
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [loadingResumes, setLoadingResumes] = useState(false);

    useEffect(() => {
        const loadResumes = async () => {
            setLoadingResumes(true);

            const resumes = (await kv.list("resume:*", true)) as KVItem[];

            const parsedResumes = resumes?.map((resume) =>
                JSON.parse(resume.value) as Resume
            );

            setResumes(parsedResumes || []);
            setLoadingResumes(false);
        };

        loadResumes();
    }, []);

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
            <Navbar />

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
                            <ResumeCard key={resume.id} resume={resume} />
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
