/**
 * Robust Client-side Backup Encryption using standard Web Crypto API:
 * - Cipher: AES-GCM (256-bit key, 128-bit authentication tag)
 * - KDF: PBKDF2 (SHA-256, 100,000 iterations)
 * - Cryptographically random 16-byte salt and 12-byte IV per encryption
 * - Strict limits against DoS (iterations between 50k and 500k, payload size limits)
 */

export const MIN_PASSPHRASE_LENGTH = 6;
export const MIN_ITERATIONS = 50_000;
export const MAX_ITERATIONS = 500_000;
export const DEFAULT_ITERATIONS = 100_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const MAX_ENCRYPTED_DATA_CHARS = 75 * 1024 * 1024; // ~50MB payload limit

export interface EncryptedBackupEnvelope {
    version: 2;
    encrypted: true;
    cipher: "AES-GCM-256";
    kdf: "PBKDF2-SHA256";
    iterations: number;
    salt: string; // base64
    iv: string; // base64
    data: string; // base64
}

export class InvalidPassphraseError extends Error {
    constructor(message = "Incorrect password or corrupted backup archive") {
        super(message);
        this.name = "InvalidPassphraseError";
    }
}

export class MalformedEncryptedBackupError extends Error {
    constructor(message = "Malformed encrypted backup archive") {
        super(message);
        this.name = "MalformedEncryptedBackupError";
    }
}

const bufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const base64ToBuffer = (base64: string): Uint8Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

export const isEncryptedBackup = (obj: unknown): obj is EncryptedBackupEnvelope => {
    if (!obj || typeof obj !== "object") return false;
    const r = obj as Record<string, unknown>;
    return (
        r.encrypted === true &&
        r.cipher === "AES-GCM-256" &&
        r.kdf === "PBKDF2-SHA256" &&
        typeof r.salt === "string" &&
        typeof r.iv === "string" &&
        typeof r.data === "string"
    );
};

const deriveKey = async (
    passphrase: string,
    saltBytes: Uint8Array,
    iterations = DEFAULT_ITERATIONS
): Promise<CryptoKey> => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
};

export const encryptBackupData = async (
    data: unknown,
    passphrase: string,
    iterations = DEFAULT_ITERATIONS
): Promise<EncryptedBackupEnvelope> => {
    if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
    }

    if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
        throw new Error(`PBKDF2 iterations must be between ${MIN_ITERATIONS} and ${MAX_ITERATIONS}`);
    }

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

    const key = await deriveKey(passphrase, salt, iterations);
    const plaintext = JSON.stringify(data);
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    );

    return {
        version: 2,
        encrypted: true,
        cipher: "AES-GCM-256",
        kdf: "PBKDF2-SHA256",
        iterations,
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv),
        data: bufferToBase64(ciphertextBuffer),
    };
};

export const decryptBackupData = async (
    envelope: unknown,
    passphrase: string
): Promise<unknown> => {
    if (!isEncryptedBackup(envelope)) {
        throw new MalformedEncryptedBackupError("The backup file is not a valid encrypted archive");
    }
    if (!passphrase || !passphrase.trim()) {
        throw new InvalidPassphraseError("Password is required to decrypt this backup");
    }

    const iterations = envelope.iterations ?? DEFAULT_ITERATIONS;
    if (
        typeof iterations !== "number" ||
        !Number.isInteger(iterations) ||
        iterations < MIN_ITERATIONS ||
        iterations > MAX_ITERATIONS
    ) {
        throw new MalformedEncryptedBackupError(
            `Invalid PBKDF2 iterations: ${iterations} (must be between ${MIN_ITERATIONS} and ${MAX_ITERATIONS})`
        );
    }

    if (envelope.data.length > MAX_ENCRYPTED_DATA_CHARS) {
        throw new MalformedEncryptedBackupError("Encrypted payload exceeds maximum allowable size (50MB)");
    }

    let saltBytes: Uint8Array;
    let ivBytes: Uint8Array;
    let dataBytes: Uint8Array;
    try {
        saltBytes = base64ToBuffer(envelope.salt);
        ivBytes = base64ToBuffer(envelope.iv);
        dataBytes = base64ToBuffer(envelope.data);
    } catch {
        throw new MalformedEncryptedBackupError("Invalid base64 encoding in encrypted archive");
    }

    if (saltBytes.byteLength !== SALT_BYTES) {
        throw new MalformedEncryptedBackupError(
            `Invalid salt length: expected ${SALT_BYTES} bytes, got ${saltBytes.byteLength}`
        );
    }
    if (ivBytes.byteLength !== IV_BYTES) {
        throw new MalformedEncryptedBackupError(
            `Invalid IV length: expected ${IV_BYTES} bytes, got ${ivBytes.byteLength}`
        );
    }

    try {
        const key = await deriveKey(passphrase, saltBytes, iterations);

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBytes },
            key,
            dataBytes
        );

        const decodedText = new TextDecoder().decode(decryptedBuffer);
        return JSON.parse(decodedText);
    } catch (err) {
        if (err instanceof MalformedEncryptedBackupError) throw err;
        throw new InvalidPassphraseError();
    }
};
