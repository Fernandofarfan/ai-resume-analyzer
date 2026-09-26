// Pure ESM shared validation and normalization module.
// Zero runtime dependencies, usable in Node.js and client browsers alike.

export const MAX_STRING_LENGTH = 2000;
export const MAX_TIPS_PER_CATEGORY = 20;
export const MAX_KEYWORDS = 50;
export const MAX_BULLET_REWRITES = 10;

export const isRecord = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const clampScore = (value) => {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        return 0;
    }
    return Math.min(100, Math.max(0, Math.round(value)));
};

export const parseTipType = (value) =>
    value === "good" ? "good" : value === "improve" ? "improve" : null;

export const parseString = (value) =>
    typeof value === "string" ? value.slice(0, MAX_STRING_LENGTH) : "";

export const parseTips = (value) => {
    if (!Array.isArray(value)) return [];
    const tips = [];
    for (const entry of value.slice(0, MAX_TIPS_PER_CATEGORY)) {
        if (!isRecord(entry)) continue;
        const type = parseTipType(entry.type);
        const tip = parseString(entry.tip);
        if (type === null || tip.length === 0) continue;
        tips.push({
            type,
            tip,
            explanation: parseString(entry.explanation),
        });
    }
    return tips;
};

export const parseCategoryStrict = (value) => {
    if (!isRecord(value)) return null;
    if (
        typeof value.score !== "number" ||
        Number.isNaN(value.score) ||
        !Number.isFinite(value.score)
    ) {
        return null;
    }
    return {
        score: clampScore(value.score),
        tips: parseTips(value.tips),
    };
};

export const parseStringArray = (value, limit = MAX_KEYWORDS) => {
    if (!Array.isArray(value)) return [];
    return value
        .slice(0, limit)
        .map(parseString)
        .filter((s) => s.length > 0);
};

export const parseKeywords = (value) => {
    if (!isRecord(value)) return undefined;
    const rawScore = value.matchScore;
    const matchScore =
        typeof rawScore === "number" && Number.isFinite(rawScore) ? clampScore(rawScore) : null;
    return {
        matchScore,
        matching: parseStringArray(value.matching, MAX_KEYWORDS),
        missing: parseStringArray(value.missing, MAX_KEYWORDS),
    };
};

export const parseBulletRewrites = (value) => {
    if (!Array.isArray(value)) return [];
    const rewrites = [];
    for (const entry of value.slice(0, MAX_BULLET_REWRITES)) {
        if (!isRecord(entry)) continue;
        const originalTip = parseString(entry.originalTip);
        const suggestedRewrite = parseString(entry.suggestedRewrite);
        const reasoning = parseString(entry.reasoning);
        if (!originalTip && !suggestedRewrite && !reasoning) continue;
        rewrites.push({ originalTip, suggestedRewrite, reasoning });
    }
    return rewrites;
};

export const validateFeedback = (value) => {
    if (!isRecord(value)) return null;
    if (
        typeof value.overallScore !== "number" ||
        Number.isNaN(value.overallScore) ||
        !Number.isFinite(value.overallScore)
    ) {
        return null;
    }

    const ats = value.ATS;
    if (
        !isRecord(ats) ||
        typeof ats.score !== "number" ||
        Number.isNaN(ats.score) ||
        !Number.isFinite(ats.score)
    ) {
        return null;
    }

    const toneAndStyle = parseCategoryStrict(value.toneAndStyle);
    const content = parseCategoryStrict(value.content);
    const structure = parseCategoryStrict(value.structure);
    const skills = parseCategoryStrict(value.skills);
    if (!toneAndStyle || !content || !structure || !skills) {
        return null;
    }

    const feedback = {
        overallScore: clampScore(value.overallScore),
        ATS: {
            score: clampScore(ats.score),
            tips: parseTips(ats.tips),
        },
        toneAndStyle,
        content,
        structure,
        skills,
    };

    const keywords = parseKeywords(value.keywords);
    if (keywords) feedback.keywords = keywords;

    const bulletRewrites = parseBulletRewrites(value.bulletRewrites);
    if (bulletRewrites.length > 0) feedback.bulletRewrites = bulletRewrites;

    return feedback;
};

export const normalizeFeedback = validateFeedback;

// Canonical description of the feedback contract. Both the prompt that asks the
// model for this shape and `validateFeedback` below come from this module, so
// they cannot drift apart.
export const FEEDBACK_JSON_SCHEMA = `{
  "overallScore": number, // 0-100, honest and realistic
  "ATS": {
    "score": number, // 0-100, how well the resume passes ATS screening
    "tips": [{ "type": "good" | "improve", "tip": string }] // 3-4 short tips
  },
  "toneAndStyle": {
    "score": number, // 0-100
    "tips": [{ "type": "good" | "improve", "tip": string, "explanation": string }] // 3-4 tips
  },
  "content": {
    "score": number, // 0-100
    "tips": [{ "type": "good" | "improve", "tip": string, "explanation": string }] // 3-4 tips
  },
  "structure": {
    "score": number, // 0-100
    "tips": [{ "type": "good" | "improve", "tip": string, "explanation": string }] // 3-4 tips
  },
  "skills": {
    "score": number, // 0-100
    "tips": [{ "type": "good" | "improve", "tip": string, "explanation": string }] // 3-4 tips
  },
  "keywords": { // REQUIRED when a job description is provided, otherwise omit it
    "matchScore": number | null, // 0-100 overlap between resume and job description
    "matching": string[], // keywords from the job description found in the resume
    "missing": string[] // keywords from the job description missing from the resume
  },
  "bulletRewrites": [{ // optional, max 10
    "originalTip": string,
    "suggestedRewrite": string,
    "reasoning": string
  }]
}`;

export const parseFeedbackText = (text) => {
    if (!text || typeof text !== "string") return null;
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    try {
        const parsed = JSON.parse(cleaned);
        return validateFeedback(parsed);
    } catch {
        return null;
    }
};

const constantTimeEqual = (a, b) => {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const enc = new TextEncoder();
    const bufA = enc.encode(a);
    const bufB = enc.encode(b);
    if (bufA.byteLength !== bufB.byteLength) return false;
    let mismatch = 0;
    for (let i = 0; i < bufA.byteLength; i++) {
        mismatch |= bufA[i] ^ bufB[i];
    }
    return mismatch === 0;
};

export const validateAuthHeader = (req, expectedToken) => {
    if (!expectedToken) return true;
    const authHeader = req.headers?.authorization;
    const apiKeyHeader = req.headers?.["x-api-key"];

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        if (constantTimeEqual(token, expectedToken)) return true;
    }

    if (apiKeyHeader && constantTimeEqual(apiKeyHeader.trim(), expectedToken)) {
        return true;
    }

    return false;
};
