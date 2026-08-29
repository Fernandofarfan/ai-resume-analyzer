import ScoreGauge from "~/components/ScoreGauge";
import ScoreBadge from "~/components/ScoreBadge";
import { useI18nStore } from "~/lib/i18n";

const Category = ({ title, score, icon }: { title: string; score: number; icon: string }) => {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 transition-all hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <ScoreBadge score={score} />
                <span className="text-sm font-bold text-slate-900 dark:text-white w-12 text-right">
                    {score}<span className="text-xs text-slate-400 font-normal">/100</span>
                </span>
            </div>
        </div>
    );
};

const Summary = ({ feedback }: { feedback: Feedback }) => {
    const { t } = useI18nStore();

    return (
        <div className="glass-card p-6 sm:p-8 w-full space-y-6">
            {/* Overall Score Header */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
                <ScoreGauge score={feedback.overallScore} />

                <div className="flex flex-col text-center sm:text-left gap-1.5">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                        {t.resume.overallScoreTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                        {t.resume.overallScoreSub}
                    </p>
                </div>
            </div>

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
