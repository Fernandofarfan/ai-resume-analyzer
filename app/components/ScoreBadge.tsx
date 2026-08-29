import { useI18nStore } from "~/lib/i18n";

interface ScoreBadgeProps {
  score: number;
}

const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score }) => {
  const { t } = useI18nStore();
  let badgeClasses = '';
  let badgeText = '';

  if (score >= 75) {
    badgeClasses = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
    badgeText = t.resume.atsSubGood;
  } else if (score >= 50) {
    badgeClasses = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
    badgeText = t.resume.atsSubStart;
  } else {
    badgeClasses = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
    badgeText = t.resume.atsSubImprove;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      <span>{badgeText}</span>
    </div>
  );
};

export default ScoreBadge;
