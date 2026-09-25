// Typed wrapper around the pure shared schema validation module.
import type { Feedback } from "~/domain/feedback";
import {
    validateFeedback as rawValidateFeedback,
    normalizeFeedback as rawNormalizeFeedback,
    parseFeedbackText as rawParseFeedbackText,
    clampScore,
    MAX_STRING_LENGTH,
    MAX_TIPS_PER_CATEGORY,
    MAX_KEYWORDS,
    MAX_BULLET_REWRITES,
} from "../../../shared/schema.mjs";

export const validateFeedback = (value: unknown): Feedback | null =>
    rawValidateFeedback(value) as Feedback | null;

export const normalizeFeedback = (value: unknown): Feedback | null =>
    rawNormalizeFeedback(value) as Feedback | null;

export const parseFeedbackText = (text: string): Feedback | null =>
    rawParseFeedbackText(text) as Feedback | null;

export {
    clampScore,
    MAX_STRING_LENGTH,
    MAX_TIPS_PER_CATEGORY,
    MAX_KEYWORDS,
    MAX_BULLET_REWRITES,
};
