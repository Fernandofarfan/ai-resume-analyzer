import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    useAppStore,
    checkAttachmentsStatus,
    deleteResumeEntity,
    estimateStorageQuota,
    runStorageGarbageCollector,
} from "~/lib/store";
import { migrateResumeHeader, isUpToDate } from "~/lib/migrations";
import { subscribeResumesChanged, withTabLock, sweepTabLocks } from "~/lib/tabsync";
import type { ResumeHeader } from "~/domain/resume";
import type { KVItem } from "~/domain/storage";

// Conservative stale threshold (25 min) to prevent deleting active tabs in the background.
const STALE_PROCESSING_MS = 25 * 60 * 1000;

/**
 * Owns the resume list shown on the home route: loading, optimistic commit,
 * storage quota, cross-tab refresh and background maintenance. State is always
 * applied from promise callbacks so effects never update state synchronously.
 */
export const useResumeList = () => {
    const { kv, fs } = useAppStore();
    // `null` means "no list yet", which is exactly the loading state; keeping
    // it in a single piece of state avoids a second flag that has to be kept
    // in sync from inside an effect.
    const [resumesState, setResumes] = useState<ResumeHeader[] | null>(null);
    const resumes = useMemo(() => resumesState ?? [], [resumesState]);
    const loadingResumes = resumesState === null;
    const [storageInfo, setStorageInfo] = useState<{
        usageMB: string;
        quotaMB: string;
        percentUsed: number;
    } | null>(null);

    const mountedRef = useRef(true);
    const loadControllerRef = useRef<AbortController | null>(null);

    const refreshStorageEstimate = useCallback(async () => {
        const estimate = await estimateStorageQuota();
        if (mountedRef.current && estimate) {
            setStorageInfo({
                usageMB: estimate.usageMB,
                quotaMB: estimate.quotaMB,
                percentUsed: estimate.percentUsed,
            });
        }
    }, []);

    // Only clears the list (and therefore the spinner) when the caller wants
    // one; silent refreshes simply replace the rows when they arrive.
    const loadResumes = useCallback(async (): Promise<ResumeHeader[] | undefined> => {
        loadControllerRef.current?.abort();
        const controller = new AbortController();
        loadControllerRef.current = controller;

        try {
            const storedResumes = (await kv.list("resume:*", true)) as KVItem[];
            if (controller.signal.aborted || !mountedRef.current) return;

            const parsedHeaders: ResumeHeader[] = [];
            const orphans: ResumeHeader[] = [];

            for (const item of storedResumes ?? []) {
                if (controller.signal.aborted) return;
                let rawObj: unknown = null;
                try {
                    rawObj = JSON.parse(item.value);
                } catch {
                    rawObj = null;
                }
                const parsed = rawObj !== null ? migrateResumeHeader(rawObj) : null;
                if (!parsed) continue;

                // Persist the migrated form once, so stale records are upgraded
                if (!isUpToDate(rawObj)) {
                    await withTabLock(`resume-write-${parsed.id}`, async () => {
                        await kv.set(item.key, JSON.stringify(parsed));
                    });
                }

                if (parsed.status === "processing") {
                    const lastBeat =
                        parsed.heartbeatAt ?? parsed.processingStartedAt ?? parsed.analyzedAt ?? 0;
                    if (Date.now() - lastBeat > STALE_PROCESSING_MS) {
                        orphans.push(parsed);
                    }
                } else {
                    parsedHeaders.push(parsed);
                }
            }

            // Verify attachments concurrently in batches to avoid slow sequential IndexedDB transactions
            const BATCH_SIZE = 8;
            for (let i = 0; i < parsedHeaders.length; i += BATCH_SIZE) {
                if (controller.signal.aborted) return;
                const batch = parsedHeaders.slice(i, i + BATCH_SIZE);
                await Promise.all(
                    batch.map(async (header) => {
                        const verifiedStatus = await checkAttachmentsStatus(
                            header.resumePath,
                            header.imagePath,
                        );
                        if (header.attachmentsStatus !== verifiedStatus) {
                            header.attachmentsStatus = verifiedStatus;
                            await withTabLock(`resume-write-${header.id}`, async () => {
                                await kv.set(`resume:${header.id}`, JSON.stringify(header));
                            });
                        }
                    }),
                );
            }

            // Clean up confirmed orphans under distributed tab lock
            for (const orphan of orphans) {
                if (controller.signal.aborted) return;
                await withTabLock(`resume-write-${orphan.id}`, async () => {
                    try {
                        if (orphan.resumePath) await fs.delete(orphan.resumePath);
                        if (orphan.imagePath) await fs.delete(orphan.imagePath);
                    } catch {
                        // Ignore — best effort
                    }
                    await deleteResumeEntity(orphan.id);
                    await kv.delete(`resume:${orphan.id}`);
                }).catch(() => {});
            }

            if (loadControllerRef.current === controller && mountedRef.current) {
                refreshStorageEstimate();
                return parsedHeaders;
            }
            return undefined;
        } catch (err) {
            if (controller.signal.aborted) return undefined;
            console.error("Failed to load resumes:", err);
            return [];
        }
    }, [kv, fs, refreshStorageEstimate]);

    // State is applied from a promise callback so effects never update state
    // synchronously.
    const commitResumes = useCallback((list: ResumeHeader[] | undefined) => {
        if (list && mountedRef.current) setResumes(list);
    }, []);

    const resetResumes = useCallback(() => {
        setResumes(null);
    }, []);

    const lastFocusLoadRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        lastFocusLoadRef.current = Date.now();
        loadResumes().then(commitResumes);
        refreshStorageEstimate();

        // Background maintenance: sweep abandoned cross-tab leases and reconcile
        // storage once on mount, then keep doing it while the tab stays open.
        sweepTabLocks();
        runStorageGarbageCollector().catch(() => {});
        const gcTimer = setInterval(
            () => {
                if (!mountedRef.current) return;
                sweepTabLocks();
                runStorageGarbageCollector()
                    .then(() => {
                        if (mountedRef.current) loadResumes().then(commitResumes);
                    })
                    .catch(() => {});
                refreshStorageEstimate();
            },
            30 * 60 * 1000,
        );

        let refreshDebounce: ReturnType<typeof setTimeout> | null = null;
        const unsubscribe = subscribeResumesChanged((msg) => {
            if (!mountedRef.current) return;
            if (msg.type === "storage-cleared") {
                setResumes([]);
                refreshStorageEstimate();
            } else {
                if (refreshDebounce) clearTimeout(refreshDebounce);
                refreshDebounce = setTimeout(() => {
                    if (mountedRef.current) loadResumes().then(commitResumes);
                }, 150);
            }
        });

        const handleFocus = () => {
            if (!mountedRef.current) return;
            const now = Date.now();
            if (now - lastFocusLoadRef.current < 2000) return;
            lastFocusLoadRef.current = now;
            loadResumes().then(commitResumes);
        };
        window.addEventListener("focus", handleFocus);

        return () => {
            mountedRef.current = false;
            clearInterval(gcTimer);
            if (refreshDebounce) clearTimeout(refreshDebounce);
            loadControllerRef.current?.abort();
            unsubscribe();
            window.removeEventListener("focus", handleFocus);
        };
    }, [loadResumes, refreshStorageEstimate, commitResumes]);

    return {
        resumes,
        loadingResumes,
        storageInfo,
        refreshStorageEstimate,
        loadResumes,
        commitResumes,
        resetResumes,
    };
};
