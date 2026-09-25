import type { Feedback } from "./feedback";

export type AttachmentsStatus = "complete" | "partial" | "missing" | "unavailable";

export interface Resume {
    id: string;
    schemaVersion?: number;
    version?: number;
    updatedAt?: number;
    operationId?: string;
    analyzedAt?: number;
    status?: "processing" | "completed" | "failed";
    attachmentsStatus?: AttachmentsStatus;
    processingStartedAt?: number;
    heartbeatAt?: number;
    processingOwnerId?: string;
    companyName?: string;
    jobTitle?: string;
    jobDescription?: string;
    imagePath: string;
    resumePath: string;
    rawText?: string;
    feedback: Feedback;
}

// Lightweight index metadata for fast search and display in home list,
// kept in localStorage while bulky rawText/blobs are saved in IndexedDB.
export interface ResumeHeader {
    id: string;
    schemaVersion?: number;
    version?: number;
    updatedAt?: number;
    analyzedAt?: number;
    status?: "processing" | "completed" | "failed";
    attachmentsStatus?: AttachmentsStatus;
    processingStartedAt?: number;
    heartbeatAt?: number;
    processingOwnerId?: string;
    companyName?: string;
    jobTitle?: string;
    overallScore?: number;
    confidence?: "low" | "medium" | "high";
    source?: "ai" | "heuristic";
    resumePath: string;
    imagePath: string;
    matchingKeywords?: string[];
    missingKeywords?: string[];
    searchSnippet?: string;
}

export const computeAttachmentsStatus = (hasPdf: boolean, hasImage: boolean): AttachmentsStatus => {
    if (hasPdf && hasImage) return "complete";
    if (hasPdf || hasImage) return "partial";
    return "missing";
};

/**
 * Builds a lightweight ResumeHeader index from a full Resume entity.
 * Generates an optimized searchSnippet for instant client-side full text search.
 */
export const buildResumeHeader = (resume: Resume): ResumeHeader => {
    // Collect distinct search tokens from rawText, jobDescription, keywords
    const keywords = [
        ...(resume.feedback?.keywords?.matching || []),
        ...(resume.feedback?.keywords?.missing || []),
    ];

    const rawSnippet = resume.rawText ? resume.rawText.slice(0, 800) : "";
    const jobSnippet = resume.jobDescription ? resume.jobDescription.slice(0, 300) : "";

    const searchSnippet = [
        resume.companyName || "",
        resume.jobTitle || "",
        ...keywords,
        rawSnippet,
        jobSnippet,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 1500);

    const hasPdf = Boolean(resume.resumePath && resume.resumePath.trim().length > 0);
    const hasImg = Boolean(resume.imagePath && resume.imagePath.trim().length > 0);

    return {
        id: resume.id,
        schemaVersion: resume.schemaVersion ?? 2,
        version: resume.version ?? 1,
        updatedAt: resume.updatedAt ?? Date.now(),
        analyzedAt: resume.analyzedAt,
        status: resume.status,
        attachmentsStatus: resume.attachmentsStatus ?? computeAttachmentsStatus(hasPdf, hasImg),
        processingStartedAt: resume.processingStartedAt,
        heartbeatAt: resume.heartbeatAt,
        processingOwnerId: resume.processingOwnerId,
        companyName: resume.companyName,
        jobTitle: resume.jobTitle,
        overallScore: resume.feedback?.overallScore,
        confidence: resume.feedback?.confidence,
        source: resume.feedback?.source,
        resumePath: resume.resumePath,
        imagePath: resume.imagePath,
        matchingKeywords: resume.feedback?.keywords?.matching,
        missingKeywords: resume.feedback?.keywords?.missing,
        searchSnippet,
    };
};
