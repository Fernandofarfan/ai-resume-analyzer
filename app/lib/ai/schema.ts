// Typed facade over the pure shared schema validation module. The declarations
// for shared/schema.mjs live next to the implementation, so no casts are needed.
export {
    validateFeedback,
    normalizeFeedback,
    parseFeedbackText,
    clampScore,
    MAX_STRING_LENGTH,
    MAX_TIPS_PER_CATEGORY,
    MAX_KEYWORDS,
    MAX_BULLET_REWRITES,
    FEEDBACK_JSON_SCHEMA,
} from "../../../shared/schema.mjs";
