import { useI18nStore } from "~/lib/i18n";

interface ScoreBadgeProps {
  score: number;
}

const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score }) => {
  const { t } = useI18nStore();
  let badgeColor = '';
  let badgeText = '';

  if (score > 70) {
    badgeColor = 'bg-badge-green text-green-600';
    badgeText = t.resume.atsSubGood;
  } else if (score > 49) {
    badgeColor = 'bg-badge-yellow text-yellow-600';
    badgeText = t.resume.atsSubStart;
  } else {
    badgeColor = 'bg-badge-red text-red-600';
    badgeText = t.resume.atsSubImprove;
  }

  return (
    <div className={`px-3 py-1 rounded-full ${badgeColor}`}>
      <p className="text-sm font-medium">{badgeText}</p>
    </div>
  );
};

export default ScoreBadge;
