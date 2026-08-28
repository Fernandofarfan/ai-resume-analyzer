import ScoreGauge from "~/components/ScoreGauge";
import ScoreBadge from "~/components/ScoreBadge";
import { useI18nStore } from "~/lib/i18n";

const Category = ({ title, score }: { title: string; score: number }) => {
    const textColor =
        score > 70
            ? "text-green-600"
            : score > 49
                ? "text-yellow-600"
                : "text-red-600";

    return (
        <div className="resume-summary">
            <div className="category">
                <div className="flex flex-row gap-2 items-center justify-center">
                    <p className="text-2xl">{title}</p>
                    <ScoreBadge score={score} />
                </div>
                <p className="text-2xl">
                    <span className={textColor}>{score}</span>/100
                </p>
            </div>
        </div>
    );
};

const Summary = ({ feedback }: { feedback: Feedback }) => {
    const { t } = useI18nStore();

    return (
        <div className="bg-white rounded-2xl shadow-md w-full">
            <div className="flex flex-row items-center p-4 gap-8">
                <ScoreGauge score={feedback.overallScore} />

                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold">{t.resume.overallScoreTitle}</h2>
                    <p className="text-sm text-gray-500">
                        {t.resume.overallScoreSub}
                    </p>
                </div>
            </div>

            <Category
                title={t.resume.categories.toneAndStyle}
                score={feedback.toneAndStyle.score}
            />
            <Category
                title={t.resume.categories.content}
                score={feedback.content.score}
            />
            <Category
                title={t.resume.categories.structure}
                score={feedback.structure.score}
            />
            <Category
                title={t.resume.categories.skills}
                score={feedback.skills.score}
            />
        </div>
    );
};

export default Summary;
