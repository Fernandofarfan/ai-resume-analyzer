interface FSItem {
    id: string;
    uid: string;
    name: string;
    path: string;
    is_dir: boolean;
    parent_id: string;
    parent_uid: string;
    created: number;
    modified: number;
    accessed: number;
    size: number | null;
    writable: boolean;
}

interface AppUser {
    uuid: string;
    username: string;
}

interface KVItem {
    key: string;
    value: string;
}

interface ChatMessageContent {
    type: "file" | "text";
    file_path?: string;
    text?: string;
}

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string | ChatMessageContent[];
}

interface ChatOptions {
    model?: string;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
}

interface AIResponse {
    index: number;
    message: {
        role: string;
        content: string | any[];
        refusal: null | string;
        annotations: any[];
    };
    logprobs: null | any;
    finish_reason: string;
    usage: any[];
    via_ai_chat_service: boolean;
}
