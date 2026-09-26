// Data migrations for persisted resume records. Older records may predate
// `source`, `confidence`, nullable `matchScore`, versioning metadata, or the domain type refactor, so
// every read is normalized through `migrateResume` or `migrateResumeHeader`.

import type { Resume, ResumeHeader } from "~/domain/resume";
import { buildResumeHeader, computeAttachmentsStatus } from "~/domain/resume";
import type { Feedback, Confidence } from "~/domain/feedback";
import { validateFeedback } from "~/lib/ai/schema";

export const RESUME_SCHEMA_VERSION = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toStr = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

export const EMPTY_FEEDBACK: Feedback = {
    overallScore: 0,
    source: "heuristic",
    ATS: { score: 0, tips: [] },
    toneAndStyle: { score: 0, tips: [] },
    content: { score: 0, tips: [] },
    structure: { score: 0, tips: [] },
    skills: { score: 0, tips: [] },
};

const normalizeFeedback = (value: unknown): Feedback => {
    const normalized = validateFeedback(value);
    if (!normalized) {
        // Placeholder that the UI detects (source === "heuristic") and
        // regenerates from the stored raw text.
        return { ...EMPTY_FEEDBACK };
    }
    if (isRecord(value)) {
        if (value.source === "ai" || value.source === "heuristic") {
            normalized.source = value.source;
        } else {
            // Legacy records did not record a source; treat them as heuristic so
            // the report is regenerated deterministically for the active language.
            normalized.source = "heuristic";
        }
        if (
            value.confidence === "low" ||
            value.confidence === "medium" ||
            value.confidence === "high"
        ) {
            normalized.confidence = value.confidence as Confidence;
        }
    }
    return normalized;
};

// True when a raw persisted record already carries the current schema version,
// so callers can persist the migrated form only once.
export const isUpToDate = (raw: unknown): boolean =>
    isRecord(raw) && raw.schemaVersion === RESUME_SCHEMA_VERSION;

export const migrateResume = (raw: unknown): Resume | null => {
    if (!isRecord(raw)) return null;
    if (
        typeof raw.id !== "string" ||
        typeof raw.resumePath !== "string" ||
        typeof raw.imagePath !== "string"
    ) {
        return null;
    }

    const analyzedAt = typeof raw.analyzedAt === "number" ? raw.analyzedAt : undefined;
    const updatedAt =
        typeof raw.updatedAt === "number" ? raw.updatedAt : (analyzedAt ?? Date.now());

    const version = typeof raw.version === "number" ? raw.version : 1;

    return {
        id: raw.id,
        schemaVersion: RESUME_SCHEMA_VERSION,
        version,
        updatedAt,
        operationId: toStr(raw.operationId),
        analyzedAt,
        status:
            raw.status === "processing" || raw.status === "completed" || raw.status === "failed"
                ? raw.status
                : undefined,
        attachmentsStatus:
            raw.attachmentsStatus === "complete" ||
            raw.attachmentsStatus === "partial" ||
            raw.attachmentsStatus === "missing" ||
            raw.attachmentsStatus === "unavailable"
                ? raw.attachmentsStatus
                : computeAttachmentsStatus(Boolean(raw.resumePath), Boolean(raw.imagePath)),
        processingStartedAt:
            typeof raw.processingStartedAt === "number" ? raw.processingStartedAt : undefined,
        heartbeatAt: typeof raw.heartbeatAt === "number" ? raw.heartbeatAt : undefined,
        processingOwnerId:
            typeof raw.processingOwnerId === "string" ? raw.processingOwnerId : undefined,
        resumePath: raw.resumePath,
        imagePath: raw.imagePath,
        companyName: toStr(raw.companyName),
        jobTitle: toStr(raw.jobTitle),
        jobDescription: toStr(raw.jobDescription),
        rawText: toStr(raw.rawText),
        feedback: normalizeFeedback(raw.feedback),
    };
};

export const migrateResumeHeader = (raw: unknown): ResumeHeader | null => {
    if (!isRecord(raw)) return null;
    if (
        typeof raw.id !== "string" ||
        typeof raw.resumePath !== "string" ||
        typeof raw.imagePath !== "string"
    ) {
        return null;
    }

    // If it's a full resume object or legacy format, use buildResumeHeader
    if (raw.feedback || raw.rawText) {
        const fullResume = migrateResume(raw);
        if (fullResume) return buildResumeHeader(fullResume);
    }

    const analyzedAt = typeof raw.analyzedAt === "number" ? raw.analyzedAt : undefined;
    const updatedAt =
        typeof raw.updatedAt === "number" ? raw.updatedAt : (analyzedAt ?? Date.now());
    const version = typeof raw.version === "number" ? raw.version : 1;

    return {
        id: raw.id,
        schemaVersion: RESUME_SCHEMA_VERSION,
        version,
        updatedAt,
        analyzedAt,
        status:
            raw.status === "processing" || raw.status === "completed" || raw.status === "failed"
                ? raw.status
                : undefined,
        attachmentsStatus:
            raw.attachmentsStatus === "complete" ||
            raw.attachmentsStatus === "partial" ||
            raw.attachmentsStatus === "missing" ||
            raw.attachmentsStatus === "unavailable"
                ? raw.attachmentsStatus
                : computeAttachmentsStatus(Boolean(raw.resumePath), Boolean(raw.imagePath)),
        processingStartedAt:
            typeof raw.processingStartedAt === "number" ? raw.processingStartedAt : undefined,
        heartbeatAt: typeof raw.heartbeatAt === "number" ? raw.heartbeatAt : undefined,
        processingOwnerId:
            typeof raw.processingOwnerId === "string" ? raw.processingOwnerId : undefined,
        companyName: toStr(raw.companyName),
        jobTitle: toStr(raw.jobTitle),
        overallScore: typeof raw.overallScore === "number" ? raw.overallScore : undefined,
        confidence:
            raw.confidence === "low" || raw.confidence === "medium" || raw.confidence === "high"
                ? raw.confidence
                : undefined,
        source: raw.source === "ai" || raw.source === "heuristic" ? raw.source : undefined,
        resumePath: raw.resumePath,
        imagePath: raw.imagePath,
        matchingKeywords: Array.isArray(raw.matchingKeywords)
            ? raw.matchingKeywords.map(String)
            : undefined,
        missingKeywords: Array.isArray(raw.missingKeywords)
            ? raw.missingKeywords.map(String)
            : undefined,
        searchSnippet:
            toStr(raw.searchSnippet) ||
            [
                toStr(raw.companyName) || "",
                toStr(raw.jobTitle) || "",
                ...(Array.isArray(raw.matchingKeywords) ? raw.matchingKeywords : []),
                ...(Array.isArray(raw.missingKeywords) ? raw.missingKeywords : []),
            ]
                .join(" ")
                .toLowerCase(),
    };
};
