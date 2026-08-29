import React from "react";
import { useI18nStore } from "~/lib/i18n";

interface KeywordTrackerProps {
    keywords?: KeywordAnalysis;
}

const KeywordTracker: React.FC<KeywordTrackerProps> = ({ keywords }) => {
    const { t } = useI18nStore();

    if (!keywords) return null;

    const { matchScore, matching = [], missing = [] } = keywords;

    return (
        <div className="glass-card p-6 w-full space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>🎯</span>
                        <span>{t.keywords.title}</span>
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {t.keywords.subtitle}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                            {t.keywords.matchRate}
                        </span>
                        <p className={`text-2xl font-black ${
                            matchScore >= 75
                                ? "text-emerald-600 dark:text-emerald-400"
                                : matchScore >= 50
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                        }`}>
                            {matchScore}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                        matchScore >= 75
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                            : matchScore >= 50
                            ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                            : "bg-gradient-to-r from-rose-500 to-red-400"
                    }`}
                    style={{ width: `${Math.max(5, matchScore)}%` }}
                />
            </div>

            {/* Grid of Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Matching Keywords */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>{t.keywords.matchingKeywords} ({matching.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {matching.length > 0 ? (
                            matching.map((kw, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                >
                                    ✓ {kw}
                                </span>
                            ))
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                No direct keyword matches detected.
                            </p>
                        )}
                    </div>
                </div>

                {/* Missing Keywords */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span>{t.keywords.missingKeywords} ({missing.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {missing.length > 0 ? (
                            missing.map((kw, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                >
                                    + {kw}
                                </span>
                            ))
                        ) : (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                {t.keywords.noMissing}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {missing.length > 0 && (
                <div className="p-3.5 rounded-xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
                    💡 <strong>{t.keywords.tipMissing}</strong>
                </div>
            )}
        </div>
    );
};

export default KeywordTracker;
