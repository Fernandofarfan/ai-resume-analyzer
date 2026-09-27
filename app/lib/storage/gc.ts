import type { Resume } from "~/domain/resume";
import { buildResumeHeader } from "~/domain/resume";
import { migrateResume } from "~/lib/migrations";
import { withTabLock } from "~/lib/tabsync";
import { kvDelete, kvList, kvSet } from "./kv";
import { STORE_RESUMES, getDB, consumeForcedListingFailure } from "./idb";
import { deleteLocalBlob, listLocalBlobs } from "./blobs";
import { getResumeEntity, hasResumeEntity, deleteResumeEntity } from "./resumes";
/**
 * Storage Garbage Collection:
 * Removes unreferenced blobs in STORE_FILES that are no longer associated with any Resume,
 * prunes abandoned "processing" resume entities whose grace period has expired, and
 * reconciles the localStorage index (`resume:*` headers) with the entity store:
 * headers whose entity disappeared are dropped, and completed entities that lost
 * their header (e.g. a failed `localStorage.setItem`) are made visible again.
 */
export const runStorageGarbageCollector = async (
    gracePeriodMs = 30 * 60 * 1000,
): Promise<{
    deletedBlobs: number;
    deletedOrphanEntities: number;
    deletedOrphanHeaders: number;
    repairedHeaders: number;
}> => {
    try {
        const db = await getDB();
        const resumes = await new Promise<Resume[]>((resolve, reject) => {
            const tx = db.transaction(STORE_RESUMES, "readonly");
            const store = tx.objectStore(STORE_RESUMES);
            // Never degrade a failed read into "no resumes exist": the blob phase
            // below would then delete every live blob.
            if (consumeForcedListingFailure()) {
                tx.abort();
                reject(new Error("Failed to list resumes"));
                return;
            }
            const req = store.getAll();
            req.onsuccess = () => resolve((req.result || []) as Resume[]);
            req.onerror = () => reject(req.error ?? new Error("Failed to list resumes"));
            tx.onabort = () => reject(tx.error ?? new Error("Resume listing aborted"));
        });

        const now = Date.now();
        let deletedBlobs = 0;
        let deletedOrphanEntities = 0;
        const activeResumes: Resume[] = [];

        // 1. Detect and prune abandoned processing resumes. Deletion happens under
        // the per-resume lock and after re-reading the entity, so a run that
        // heartbeats or commits while the GC is scanning is never pruned.
        for (const r of resumes) {
            if (r.status === "processing") {
                const lastActivity = r.heartbeatAt || r.updatedAt || r.processingStartedAt || 0;
                if (now - lastActivity >= gracePeriodMs) {
                    const pruned = await withTabLock(`resume-write-${r.id}`, async () => {
                        const current = await getResumeEntity(r.id).catch(() => null);
                        if (!current || current.status !== "processing") return null;
                        const currentActivity =
                            current.heartbeatAt ||
                            current.updatedAt ||
                            current.processingStartedAt ||
                            0;
                        if (Date.now() - currentActivity < gracePeriodMs) return null;

                        await deleteResumeEntity(current.id);
                        let blobs = 0;
                        for (const path of [current.resumePath, current.imagePath]) {
                            if (!path) continue;
                            const deleted = await deleteLocalBlob(path).catch(() => false);
                            if (deleted) blobs++;
                        }
                        return { blobs };
                    }).catch(() => null);
                    if (pruned) {
                        deletedBlobs += pruned.blobs;
                        deletedOrphanEntities++;
                        continue;
                    }
                }
            }
            activeResumes.push(r);
        }

        const activePaths = new Set<string>();
        for (const r of activeResumes) {
            if (r.resumePath) activePaths.add(r.resumePath);
            if (r.imagePath) activePaths.add(r.imagePath);
        }

        const blobs = await listLocalBlobs();

        for (const blob of blobs) {
            if (!activePaths.has(blob.path)) {
                if (now - blob.created >= gracePeriodMs) {
                    const deleted = await deleteLocalBlob(blob.path).catch(() => false);
                    if (deleted) deletedBlobs++;
                }
            }
        }

        // 3. Reconcile the localStorage index with the entity store.
        let deletedOrphanHeaders = 0;
        let repairedHeaders = 0;

        const headerKeys = (await kvList("resume:*")) as string[];
        const headerIds = new Set<string>();
        for (const key of headerKeys) {
            const id = key.startsWith("resume:") ? key.slice("resume:".length) : "";
            if (!id) continue;
            headerIds.add(id);
            const removed = await withTabLock(`resume-write-${id}`, async () => {
                if (await hasResumeEntity(id)) return false;
                await kvDelete(key);
                return true;
            }).catch(() => false);
            if (removed) deletedOrphanHeaders++;
        }

        // Completed entities without an index header are invisible in the list;
        // in-flight uploads are skipped because they write their header on commit.
        for (const r of activeResumes) {
            if (headerIds.has(r.id) || r.status === "processing") continue;
            const repaired = await withTabLock(`resume-write-${r.id}`, async () => {
                if (headerIds.has(r.id)) return false;
                // Migrate first: `buildResumeHeader` would otherwise stamp missing
                // timestamps with `Date.now()` and make legacy rows look fresh.
                const migrated = migrateResume(r) ?? r;
                return await kvSet(`resume:${r.id}`, JSON.stringify(buildResumeHeader(migrated)));
            }).catch(() => false);
            if (repaired) repairedHeaders++;
        }

        return { deletedBlobs, deletedOrphanEntities, deletedOrphanHeaders, repairedHeaders };
    } catch {
        return {
            deletedBlobs: 0,
            deletedOrphanEntities: 0,
            deletedOrphanHeaders: 0,
            repairedHeaders: 0,
        };
    }
};
