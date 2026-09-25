export const MAX_STRING_LENGTH: number;
export const MAX_TIPS_PER_CATEGORY: number;
export const MAX_KEYWORDS: number;
export const MAX_BULLET_REWRITES: number;

export function clampScore(value: unknown): number;
export function validateFeedback(value: unknown): any;
export function normalizeFeedback(value: unknown): any;
export function parseFeedbackText(text: string): any;
export function validateAuthHeader(
    req: { headers?: Record<string, string | undefined> },
    expectedToken?: string
): boolean;
