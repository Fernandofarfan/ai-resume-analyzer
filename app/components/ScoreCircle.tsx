import { useId } from "react";

const ScoreCircle = ({ score = 75 }: { score: number }) => {
    const gradientId = useId();
    const radius = 38;
    const stroke = 7;
    const normalizedRadius = radius - stroke / 2;
    const circumference = 2 * Math.PI * normalizedRadius;
    const progress = Math.min(100, Math.max(0, score)) / 100;
    const strokeDashoffset = circumference * (1 - progress);

    const getScoreColor = () => {
        if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
        if (score >= 50) return "text-amber-600 dark:text-amber-400";
        return "text-rose-600 dark:text-rose-400";
    };

    return (
        <div className="relative w-[84px] h-[84px]">
            <svg
                height="100%"
                width="100%"
                viewBox="0 0 84 84"
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx="42"
                    cy="42"
                    r={normalizedRadius}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth={stroke}
                    fill="transparent"
                />
                {/* Partial circle with gradient */}
                <defs>
                    <linearGradient id={gradientId} x1="1" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                </defs>
                <circle
                    cx="42"
                    cy="42"
                    r={normalizedRadius}
                    stroke={`url(#${gradientId})`}
                    strokeWidth={stroke}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>

            {/* Score Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`font-black text-sm tracking-tight ${getScoreColor()}`}>
                    {score}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase">ATS</span>
            </div>
        </div>
    );
};

export default ScoreCircle;
