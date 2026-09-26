import { create } from "zustand";
import {
    saveLocalBlob,
    getLocalBlob,
    deleteLocalBlob,
    clearAllBlobs,
    saveResumeEntity,
    getResumeEntity,
    deleteResumeEntity,
    clearAllResumeEntities,
    estimateStorageQuota,
    exportAllResumeData,
    importBackupData,
    runStorageGarbageCollector,
    checkAttachmentsStatus,
} from "./storage/indexeddb";

export {
    encryptBackupData,
    decryptBackupData,
    isEncryptedBackup,
    InvalidPassphraseError,
    MalformedEncryptedBackupError,
} from "./storage/crypto";

export {
    saveResumeEntity,
    getResumeEntity,
    deleteResumeEntity,
    clearAllResumeEntities,
    estimateStorageQuota,
    exportAllResumeData,
    importBackupData,
    runStorageGarbageCollector,
    checkAttachmentsStatus,
};
import { kvGet, kvSet, kvDelete, kvList, kvFlushResumeData } from "./storage/kv";
import {
    requestRemoteAnalysis,
    OfflineModeError,
    ConsentRequiredError,
    UnauthorizedError,
} from "./ai/providers";
import { analyzeResumeContent } from "./analysis/heuristic";
import type { FSItem, KVItem } from "~/domain/storage";
import type { AIResponse } from "~/domain/ai";

export {
    generateResumeFeedback,
    containsKeyword,
    normalizeText,
    computeConfidence,
    extractProfileSignals,
} from "./analysis/heuristic";

interface AppStore {
    fs: {
        read: (path: string) => Promise<Blob | undefined>;
        upload: (files: File[] | Blob[]) => Promise<FSItem | undefined>;
        delete: (path: string) => Promise<void>;
    };
    ai: {
        feedback: (
            message: string,
            consent: boolean,
            signal?: AbortSignal,
        ) => Promise<AIResponse | undefined>;
    };
    kv: {
        get: (key: string) => Promise<string | null | undefined>;
        set: (key: string, value: string) => Promise<boolean | undefined>;
        delete: (key: string) => Promise<boolean | undefined>;
        list: (pattern: string, returnValues?: boolean) => Promise<string[] | KVItem[] | undefined>;
        flush: () => Promise<boolean | undefined>;
    };
}

export const useAppStore = create<AppStore>(() => {
    const readFile = async (path: string): Promise<Blob | undefined> => {
        return getLocalBlob(path);
    };

    const upload = async (files: File[] | Blob[]): Promise<FSItem | undefined> => {
        const firstFile = files[0];
        if (!firstFile) return undefined;

        const fileName = (firstFile as File).name || `upload_${Date.now()}.bin`;
        const path = `local://${Date.now()}_${fileName}`;
        return saveLocalBlob(path, firstFile, fileName);
    };

    const deleteFile = async (path: string): Promise<void> => {
        await deleteLocalBlob(path);
    };

    const runAIInference = async (
        message: string,
        consent: boolean,
        signal?: AbortSignal,
    ): Promise<{
        content: string;
        source: "ai" | "heuristic";
        fallbackReason?: "provider-fallback" | "offline-mode";
    }> => {
        let fallbackReason: "provider-fallback" | "offline-mode" | undefined;
        try {
            const content = await requestRemoteAnalysis(message, consent, signal);
            return { content, source: "ai" };
        } catch (err) {
            // Do not swallow cancellation, missing-consent or authentication errors:
            // they must reach the caller instead of silently falling back.
            if (
                err instanceof Error &&
                (err.name === "AbortError" ||
                    err instanceof ConsentRequiredError ||
                    err instanceof UnauthorizedError)
            ) {
                throw err;
            }
            if (!(err instanceof OfflineModeError)) {
                console.warn("Remote AI failed, using heuristic fallback:", err);
                fallbackReason = "provider-fallback";
            } else {
                fallbackReason = "offline-mode";
            }
        }

        const fallbackAnalysis = analyzeResumeContent(message);
        return { content: JSON.stringify(fallbackAnalysis), source: "heuristic", fallbackReason };
    };

    const feedback = async (
        message: string,
        consent: boolean,
        signal?: AbortSignal,
    ): Promise<AIResponse | undefined> => {
        const { content, source, fallbackReason } = await runAIInference(message, consent, signal);
        return {
            index: 0,
            message: {
                role: "assistant",
                content,
                refusal: null,
                annotations: [],
            },
            logprobs: null,
            finish_reason: "stop",
            usage: [],
            via_ai_chat_service: false,
            source,
            fallbackReason,
        };
    };

    const flushKV = async (): Promise<boolean> => {
        // Remove metadata (localStorage), binary blobs (IndexedDB), and full
        // resume entity records so that no resume data survives a "delete all" action.
        await kvFlushResumeData();
        await clearAllBlobs();
        await clearAllResumeEntities();
        return true;
    };

    return {
        fs: {
            read: readFile,
            upload,
            delete: deleteFile,
        },
        ai: {
            feedback,
        },
        kv: {
            get: kvGet,
            set: kvSet,
            delete: kvDelete,
            list: kvList,
            flush: flushKV,
        },
    };
});
