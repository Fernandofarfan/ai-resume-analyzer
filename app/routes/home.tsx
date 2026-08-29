import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import ResumeCard from "~/components/ResumeCard";
import { useAppStore } from "~/lib/store";
import { Link } from "react-router";
import { useEffect, useState, useMemo } from "react";
import { useI18nStore } from "~/lib/i18n";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "CVision AI | Smart ATS Resume Analyzer & Optimizer" },
        { name: "description", content: "AI-powered resume audit, keyword matching, and ATS score optimization." },
    ];
}

export default function Home() {
    const { kv, fs } = useAppStore();
    const { t } = useI18nStore();
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [loadingResumes, setLoadingResumes] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [scoreFilter, setScoreFilter] = useState<"all" | "high" | "medium" | "low">("all");

    const loadResumes = async () => {
        setLoadingResumes(true);

        const storedResumes = (await kv.list("resume:*", true)) as KVItem[];

        const parsedResumes = storedResumes?.map((resume) => {
            try {
                return JSON.parse(resume.value) as Resume;
            } catch {
                return null;
            }
        }).filter(Boolean) as Resume[];

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

    // Filtered Resumes
    const filteredResumes = useMemo(() => {
        return resumes.filter((r) => {
            const matchesSearch =
                (r.companyName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
                (r.jobTitle?.toLowerCase() || "").includes(searchQuery.toLowerCase());

            const score = r.feedback?.overallScore || 0;
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
                                onClick={() => setDeletingId(null)}
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
                            {t.home.heroTitle.includes("&") ? `& ${t.home.heroTitle.split("&")[1]}` : ""}
                        </span>
                    </h1>

                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                        {t.home.heroSubtitle}
                    </p>

                    {/* Primary CTA */}
                    <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                        <Link to="/upload" className="primary-button text-sm sm:text-base py-3 px-8">
                            <span>🚀</span>
                            <span>{t.home.uploadFirstButton}</span>
                        </Link>
                    </div>
                </div>

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
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-2">
                            <span>{filteredResumes.length} {t.home.resumesFound}</span>
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
                        <p className="text-xs text-slate-500">
                            {t.home.noResultsDesc}
                        </p>
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
                        <Link to="/upload" className="primary-button text-sm py-3 px-6 inline-flex">
                            {t.home.uploadFirstButton}
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
