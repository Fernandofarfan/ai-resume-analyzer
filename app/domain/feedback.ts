export type TipType = "good" | "improve";
export type FeedbackSource = "ai" | "heuristic";
export type Confidence = "low" | "medium" | "high";

export interface KeywordAnalysis {
    matchScore: number | null;
    matching: string[];
    missing: string[];
}

export interface BulletRewrite {
    originalTip: string;
    suggestedRewrite: string;
    reasoning: string;
}

export interface FeedbackTip {
    type: TipType;
    tip: string;
    explanation: string;
}

export interface AtsTip {
    type: TipType;
    tip: string;
}

export interface CategoryFeedback {
    score: number;
    tips: FeedbackTip[];
}

export interface Feedback {
    overallScore: number;
    source?: FeedbackSource;
    confidence?: Confidence;
    fallbackReason?: "provider-fallback" | "offline-mode" | string;
    ATS: {
        score: number;
        tips: AtsTip[];
    };
    toneAndStyle: CategoryFeedback;
    content: CategoryFeedback;
    structure: CategoryFeedback;
    skills: CategoryFeedback;
    keywords?: KeywordAnalysis;
    bulletRewrites?: BulletRewrite[];
}
