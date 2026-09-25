import type { Feedback } from "../app/domain/feedback";

export declare const MAX_STRING_LENGTH: number;
export declare const MAX_TIPS_PER_CATEGORY: number;
export declare const MAX_KEYWORDS: number;
export declare const MAX_BULLET_REWRITES: number;

export declare function clampScore(value: unknown): number;
export declare function validateFeedback(value: unknown): Feedback | null;
export declare function normalizeFeedback(value: unknown): Feedback | null;
export declare function parseFeedbackText(text: string): Feedback | null;
export declare function validateAuthHeader(
    req: { headers?: Record<string, string | undefined> },
    expectedToken?: string
): boolean;
