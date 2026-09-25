import { useState } from "react";
import {
    Accordion,
    AccordionContent,
    AccordionHeader,
    AccordionItem,
} from "./Accordion";
import ScoreBadge from "~/components/ScoreBadge";
import { useI18nStore } from "~/lib/i18n";
import type { Feedback, BulletRewrite } from "~/domain/feedback";

const CategoryHeader = ({
    title,
    categoryScore,
}: {
    title: string;
    categoryScore: number;
}) => {
    return (
        <div className="flex flex-row items-center justify-between w-full py-1 pr-2">
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {title}
            </span>
            <ScoreBadge score={categoryScore} />
        </div>
    );
};

const CategoryContent = ({
    tips,
    bulletRewrites = [],
}: {
    tips: { type: "good" | "improve"; tip: string; explanation: string }[];
    bulletRewrites?: BulletRewrite[];
}) => {
    const { t } = useI18nStore();
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [copyErrorIndex, setCopyErrorIndex] = useState<number | null>(null);

    const handleCopy = (text: string, idx: number) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopiedIndex(idx);
                setCopyErrorIndex(null);
                setTimeout(() => setCopiedIndex(null), 2000);
            })
            .catch((err) => {
                console.error("Failed to copy text:", err);
                setCopyErrorIndex(idx);
                setTimeout(() => setCopyErrorIndex(null), 3000);
            });
    };

    return (
        <div className="flex flex-col gap-4 w-full pt-2">
            <div className="flex flex-col gap-3.5 w-full">
                {tips.map((tip, index) => {
                    const rewrite = bulletRewrites[index % (bulletRewrites.length || 1)];

                    return (
                        <div
                            key={index + tip.tip}
                            className={`flex flex-col gap-3 rounded-2xl p-4 sm:p-5 border transition-all ${
                                tip.type === "good"
                                    ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                                    : "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200"
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="text-base">
                                    {tip.type === "good" ? "✓" : "⚠️"}
                                </span>
                                <h4 className="text-sm sm:text-base font-bold">
                                    {tip.tip}
                                </h4>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-6">
                                {tip.explanation}
                            </p>

                            {/* Google XYZ Formula Suggestion for Improve items */}
                            {tip.type === "improve" && rewrite && (
                                <div className="mt-2 ml-6 p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-amber-500/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            <span>✨</span> {t.bulletImprover.suggestedRewrite}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(rewrite.suggestedRewrite, index)}
                                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                        >
                                            {copiedIndex === index ? t.bulletImprover.copied : t.bulletImprover.applyIdea}
                                        </button>
                                    </div>
                                    <p className="text-xs font-mono text-slate-800 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-950/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                                        "{rewrite.suggestedRewrite}"
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                        {rewrite.reasoning}
                                    </p>
                                    {copyErrorIndex === index && (
                                        <p role="alert" className="text-[10px] text-rose-600 dark:text-rose-400">
                                            {t.bulletImprover.copyError}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const Details = ({ feedback }: { feedback: Feedback }) => {
    const { t } = useI18nStore();

    return (
        <div className="glass-card p-6 sm:p-8 w-full space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
                {t.resume.reviewHeading}
            </h3>

            <Accordion allowMultiple defaultOpen="tone-style">
                <AccordionItem id="tone-style" className="border-b border-slate-200/80 dark:border-slate-800/80 py-1">
                    <AccordionHeader itemId="tone-style">
                        <CategoryHeader
                            title={t.resume.categories.toneAndStyle}
                            categoryScore={feedback.toneAndStyle.score}
                        />
                    </AccordionHeader>
                    <AccordionContent itemId="tone-style">
                        <CategoryContent
                            tips={feedback.toneAndStyle.tips}
                            bulletRewrites={feedback.bulletRewrites}
                        />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem id="content" className="border-b border-slate-200/80 dark:border-slate-800/80 py-1">
                    <AccordionHeader itemId="content">
                        <CategoryHeader
                            title={t.resume.categories.content}
                            categoryScore={feedback.content.score}
                        />
                    </AccordionHeader>
                    <AccordionContent itemId="content">
                        <CategoryContent
                            tips={feedback.content.tips}
                            bulletRewrites={feedback.bulletRewrites}
                        />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem id="structure" className="border-b border-slate-200/80 dark:border-slate-800/80 py-1">
                    <AccordionHeader itemId="structure">
                        <CategoryHeader
                            title={t.resume.categories.structure}
                            categoryScore={feedback.structure.score}
                        />
                    </AccordionHeader>
                    <AccordionContent itemId="structure">
                        <CategoryContent tips={feedback.structure.tips} />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem id="skills" className="py-1">
                    <AccordionHeader itemId="skills">
                        <CategoryHeader
                            title={t.resume.categories.skills}
                            categoryScore={feedback.skills.score}
                        />
                    </AccordionHeader>
                    <AccordionContent itemId="skills">
                        <CategoryContent tips={feedback.skills.tips} />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

export default Details;
