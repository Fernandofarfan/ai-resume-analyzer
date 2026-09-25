declare module "../../../shared/schema.mjs" {
    import type { Feedback, KeywordAnalysis, BulletRewrite, FeedbackTip } from "~/domain/feedback";

    export const MAX_STRING_LENGTH: number;
    export const MAX_TIPS_PER_CATEGORY: number;
    export const MAX_KEYWORDS: number;
    export const MAX_BULLET_REWRITES: number;

    export function clampScore(value: unknown): number;
    export function validateFeedback(value: unknown): Feedback | null;
    export function normalizeFeedback(value: unknown): Feedback | null;
    export function parseFeedbackText(text: string): Feedback | null;
    export function validateAuthHeader(
        req: { headers?: Record<string, string | undefined> },
        expectedToken?: string
    ): boolean;
}
