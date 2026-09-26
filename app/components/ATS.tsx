import React from "react";
import { useI18nStore } from "~/lib/i18n";
import ScoreBadge from "~/components/ScoreBadge";

interface Suggestion {
    type: "good" | "improve";
    tip: string;
}

interface ATSProps {
    score: number;
    suggestions: Suggestion[];
}

const ATS: React.FC<ATSProps> = ({ score, suggestions }) => {
    const { t } = useI18nStore();

    const getScoreBorder = () => {
        if (score >= 75) return "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10";
        if (score >= 50) return "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10";
        return "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10";
    };

    const subtitle =
        score >= 75
            ? t.resume.atsSubGood
            : score >= 50
              ? t.resume.atsSubStart
              : t.resume.atsSubImprove;

    return (
        <div className={`glass-card p-6 sm:p-8 w-full border ${getScoreBorder()}`}>
            {/* Top section with score and headline */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-500/20">
                        ⚡
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                            {t.resume.atsTitle}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {subtitle}
                        </p>
                    </div>
                </div>
                <div>
                    <ScoreBadge score={score} />
                </div>
            </div>

            {/* Description section */}
            <div className="mb-6">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                    {t.resume.atsDescription}
                </p>

                {/* Suggestions list */}
                <div className="space-y-3">
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={index}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
                                suggestion.type === "good"
                                    ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                                    : "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
                            }`}
                        >
                            <span className="text-base shrink-0 mt-0.5">
                                {suggestion.type === "good" ? "✓" : "⚠️"}
                            </span>
                            <p className="text-sm font-medium leading-normal">{suggestion.tip}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Closing encouragement */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>💡</span>
                <span className="italic">{t.resume.atsEncouragement}</span>
            </div>
        </div>
    );
};

export default ATS;
