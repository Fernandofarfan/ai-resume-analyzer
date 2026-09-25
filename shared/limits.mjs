// Shared business limits and constraints used across both server and client.
// Zero runtime dependencies, pure ESM module.

export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB max uploaded document size
export const MAX_BODY_BYTES = 1_000_000; // 1 MB max API request body
export const MAX_PROMPT_CHARS = 100_000; // 100,000 characters prompt text
export const MAX_PDF_PAGES = 10; // Maximum allowed document pages
export const MAX_BACKUP_RESUMES = 50; // Maximum resumes in a single backup export/import
export const MAX_BACKUP_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB max total backup archive size
export const MAX_INDIVIDUAL_BLOB_BYTES = 20 * 1024 * 1024; // 20 MB max size per individual blob
