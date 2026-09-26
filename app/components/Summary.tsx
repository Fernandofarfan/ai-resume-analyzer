import { useState } from "react";
import ScoreGauge from "~/components/ScoreGauge";
import ScoreBadge from "~/components/ScoreBadge";
import { useI18nStore } from "~/lib/i18n";
import type { Feedback } from "~/domain/feedback";

const Category = ({ title, score, icon }: { title: string; score: number; icon: string }) => {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 transition-all hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {title}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <ScoreBadge score={score} />
                <span className="text-sm font-bold text-slate-900 dark:text-white w-12 text-right">
                    {score}
                    <span className="text-xs text-slate-400 font-normal">/100</span>
                </span>
            </div>
        </div>
    );
};

const Summary = ({ feedback, analyzedAt }: { feedback: Feedback; analyzedAt?: number }) => {
    const { t } = useI18nStore();
    const [showFactors, setShowFactors] = useState(false);

    const sourceLabel = feedback.source === "ai" ? t.resume.sourceAI : t.resume.sourceHeuristic;
    const analyzedDate = analyzedAt
        ? new Date(analyzedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
          })
        : null;

    const confidenceLabel =
        feedback.confidence === "high"
            ? t.resume.confidenceHigh
            : feedback.confidence === "medium"
              ? t.resume.confidenceMedium
              : feedback.confidence === "low"
                ? t.resume.confidenceLow
                : null;

    const confidenceHint =
        feedback.confidence === "high"
            ? t.resume.confidenceHighHint
            : feedback.confidence === "medium"
              ? t.resume.confidenceMediumHint
              : feedback.confidence === "low"
                ? t.resume.confidenceLowHint
                : undefined;

    return (
        <div className="glass-card p-6 sm:p-8 w-full space-y-6">
            {feedback.fallbackReason === "provider-fallback" && (
                <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5"
                >
                    <span className="text-base">⚠️</span>
                    <span>{t.resume.fallbackNotice}</span>
                </div>
            )}

            {/* Overall Score Header */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
                <ScoreGauge score={feedback.overallScore} />

                <div className="flex flex-col text-center sm:text-left gap-1.5 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                            {t.resume.overallScoreTitle}
                        </h2>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                        {t.resume.overallScoreSub}
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {feedback.source === "ai" ? "🤖" : "⚙️"} {sourceLabel}
                        </span>

                        {confidenceLabel && (
                            <span
                                title={confidenceHint}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold"
                            >
                                🎯 {confidenceLabel}
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowFactors(!showFactors)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer ml-1"
                        >
                            <span>ℹ️</span>
                            <span>{t.resume.factorsTitle}</span>
                            <span className="text-[9px]">{showFactors ? "▲" : "▼"}</span>
                        </button>
                    </div>

                    {analyzedDate && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            {t.resume.analyzedLabel} {analyzedDate}
                        </p>
                    )}
                </div>
            </div>

            {/* Explanatory Factors Section */}
            {showFactors && (
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-3 animate-in fade-in duration-200">
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            {t.resume.factorsTitle}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t.resume.factorsSubtitle}
                        </p>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <li className="flex items-start gap-2">
                            <span>📄</span>
                            <span>{t.resume.factorsList.textClarity}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span>🎯</span>
                            <span>{t.resume.factorsList.jobMatch}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span>🔑</span>
                            <span>{t.resume.factorsList.keywordsDensity}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span>📈</span>
                            <span>{t.resume.factorsList.metricsFormula}</span>
                        </li>
                        <li className="flex items-start gap-2 sm:col-span-2">
                            <span>📑</span>
                            <span>{t.resume.factorsList.structureAts}</span>
                        </li>
                    </ul>
                </div>
            )}

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Category
                    icon="✍️"
                    title={t.resume.categories.toneAndStyle}
                    score={feedback.toneAndStyle.score}
                />
                <Category
                    icon="📊"
                    title={t.resume.categories.content}
                    score={feedback.content.score}
                />
                <Category
                    icon="📑"
                    title={t.resume.categories.structure}
                    score={feedback.structure.score}
                />
                <Category
                    icon="🛠️"
                    title={t.resume.categories.skills}
                    score={feedback.skills.score}
                />
            </div>
        </div>
    );
};

export default Summary;
