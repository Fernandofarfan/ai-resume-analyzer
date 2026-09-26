import { describe, it, expect } from "vitest";
import {
    encryptBackupData,
    decryptBackupData,
    isEncryptedBackup,
    InvalidPassphraseError,
    MalformedEncryptedBackupError,
    MIN_PASSPHRASE_LENGTH,
    CURRENT_ENVELOPE_VERSION,
} from "./crypto";

describe("Web Crypto API AES-GCM Backup Encryption", () => {
    it("encrypts and decrypts backup payload losslessly with correct password", async () => {
        const payload = {
            version: 2,
            resumes: [
                {
                    entity: { id: "res-123", companyName: "Google Cloud", jobTitle: "SRE" },
                    pdfBase64: "data:application/pdf;base64,JVBERi0xLjQK...",
                },
            ],
        };

        const password = "super-secret-master-password-123!";
        const encrypted = await encryptBackupData(payload, password);

        expect(isEncryptedBackup(encrypted)).toBe(true);
        expect(encrypted.version).toBe(CURRENT_ENVELOPE_VERSION);
        expect(encrypted.cipher).toBe("AES-GCM-256");
        expect(encrypted.kdf).toBe("PBKDF2-SHA256");
        expect(typeof encrypted.salt).toBe("string");
        expect(typeof encrypted.iv).toBe("string");
        expect(typeof encrypted.data).toBe("string");

        const decrypted = await decryptBackupData(encrypted, password);
        expect(decrypted).toEqual(payload);
    });

    it("rejects decryption with incorrect password", async () => {
        const payload = { secret: "confidential resume data" };
        const encrypted = await encryptBackupData(payload, "correct-password");

        await expect(decryptBackupData(encrypted, "wrong-password")).rejects.toThrow(
            InvalidPassphraseError,
        );
    });

    it("rejects password shorter than minimum length during encryption", async () => {
        await expect(encryptBackupData({ a: 1 }, "12345")).rejects.toThrow(
            `Password must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
        );
    });

    it("authenticates the envelope metadata of new archives", async () => {
        const encrypted = await encryptBackupData({ secret: "value" }, "correct-password");
        const relabeled = { ...encrypted, version: 2 as const };

        await expect(decryptBackupData(relabeled, "correct-password")).rejects.toThrow(
            InvalidPassphraseError,
        );
    });

    it("still decrypts legacy v2 archives written without authenticated metadata", async () => {
        const payload = { version: 2, resumes: [{ entity: { id: "legacy-1" } }] };
        const passphrase = "legacy-password-1";
        const enc = new TextEncoder();
        const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...Array.from(bytes)));

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const material = await crypto.subtle.importKey(
            "raw",
            enc.encode(passphrase),
            { name: "PBKDF2" },
            false,
            ["deriveKey"],
        );
        const key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: 50_000, hash: "SHA-256" },
            material,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"],
        );
        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            enc.encode(JSON.stringify(payload)),
        );

        const legacyEnvelope = {
            version: 2,
            encrypted: true,
            cipher: "AES-GCM-256",
            kdf: "PBKDF2-SHA256",
            iterations: 50_000,
            salt: toBase64(salt),
            iv: toBase64(iv),
            data: toBase64(new Uint8Array(ciphertext)),
        };

        await expect(decryptBackupData(legacyEnvelope, passphrase)).resolves.toEqual(payload);
    });

    it("rejects excessive or insufficient PBKDF2 iterations", async () => {
        const valid = await encryptBackupData({ a: 1 }, "valid-password");

        const tooManyIterations = { ...valid, iterations: 10_000_000 };
        await expect(decryptBackupData(tooManyIterations, "valid-password")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );

        const tooFewIterations = { ...valid, iterations: 1_000 };
        await expect(decryptBackupData(tooFewIterations, "valid-password")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );
    });

    it("rejects invalid salt and IV lengths", async () => {
        const valid = await encryptBackupData({ a: 1 }, "valid-password");

        const badSalt = { ...valid, salt: btoa("short-salt") };
        await expect(decryptBackupData(badSalt, "valid-password")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );

        const badIv = { ...valid, iv: btoa("short-iv") };
        await expect(decryptBackupData(badIv, "valid-password")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );
    });

    it("rejects malformed or tampered encrypted backups", async () => {
        await expect(decryptBackupData({}, "some-password")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );

        await expect(decryptBackupData(null, "some-password")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );

        const valid = await encryptBackupData({ test: 1 }, "password123");
        const tampered = { ...valid, data: valid.data.slice(0, -8) + "AAAA" };

        await expect(decryptBackupData(tampered, "password123")).rejects.toThrow(
            InvalidPassphraseError,
        );

        const corruptedBase64 = { ...valid, data: "???not-valid-base64!!!" };
        await expect(decryptBackupData(corruptedBase64, "password123")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );

        const unknownCipher = { ...valid, cipher: "UNKNOWN-CIPHER" };
        await expect(decryptBackupData(unknownCipher, "password123")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );

        const unknownKdf = { ...valid, kdf: "UNKNOWN-KDF" };
        await expect(decryptBackupData(unknownKdf, "password123")).rejects.toThrow(
            MalformedEncryptedBackupError,
        );
    });
});
