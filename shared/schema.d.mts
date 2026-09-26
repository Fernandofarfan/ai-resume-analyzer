import type { Feedback } from "../app/domain/feedback";

export const MAX_STRING_LENGTH: number;
export const MAX_TIPS_PER_CATEGORY: number;
export const MAX_KEYWORDS: number;
export const MAX_BULLET_REWRITES: number;

// Single description of the feedback contract shared by the prompt that is sent
// to the model and the validator that checks its answer.
export const FEEDBACK_JSON_SCHEMA: string;

export declare function clampScore(value: unknown): number;
export declare function validateFeedback(value: unknown): Feedback | null;
export declare function normalizeFeedback(value: unknown): Feedback | null;
export declare function parseFeedbackText(text: string): Feedback | null;
export declare function validateAuthHeader(
    req: { headers?: Record<string, string | undefined> },
    expectedToken?: string,
): boolean;
