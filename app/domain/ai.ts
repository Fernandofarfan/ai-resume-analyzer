import type { FeedbackSource } from "./feedback";

export interface ChatMessageContent {
    type: "file" | "text";
    file_path?: string;
    text?: string;
}

export interface AIResponse {
    index: number;
    message: {
        role: string;
        content: string | ChatMessageContent[];
        refusal: null | string;
        annotations: unknown[];
    };
    logprobs: null | unknown;
    finish_reason: string;
    usage: unknown[];
    via_ai_chat_service: boolean;
    source?: FeedbackSource;
    fallbackReason?: "provider-fallback" | "offline-mode" | string;
}
