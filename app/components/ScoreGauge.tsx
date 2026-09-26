import { useEffect, useRef, useState } from "react";

const ScoreGauge = ({ score = 75 }: { score: number }) => {
    const [pathLength, setPathLength] = useState(0);
    const pathRef = useRef<SVGPathElement>(null);

    const percentage = Math.min(100, Math.max(0, score)) / 100;

    useEffect(() => {
        if (pathRef.current) {
            setPathLength(pathRef.current.getTotalLength());
        }
    }, []);

    const getScoreColor = () => {
        if (score >= 75) return "text-emerald-500 dark:text-emerald-400";
        if (score >= 50) return "text-amber-500 dark:text-amber-400";
        return "text-rose-500 dark:text-rose-400";
    };

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-44 h-24">
                <svg viewBox="0 0 100 55" className="w-full h-full">
                    <defs>
                        <linearGradient id="modernGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="50%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                    </defs>

                    {/* Background arc */}
                    <path
                        d="M10,50 A40,40 0 0,1 90,50"
                        fill="none"
                        className="stroke-slate-200 dark:stroke-slate-800"
                        strokeWidth="9"
                        strokeLinecap="round"
                    />

                    {/* Foreground progress arc */}
                    <path
                        ref={pathRef}
                        d="M10,50 A40,40 0 0,1 90,50"
                        fill="none"
                        stroke="url(#modernGaugeGradient)"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={pathLength}
                        strokeDashoffset={pathLength * (1 - percentage)}
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                    <div className={`text-2xl font-black tracking-tight ${getScoreColor()}`}>
                        {score}
                        <span className="text-xs text-slate-400 font-semibold">/100</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScoreGauge;
