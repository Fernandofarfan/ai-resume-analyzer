import type { Resume } from "~/domain/resume";
import { buildResumeHeader } from "~/domain/resume";
import { withTabLock } from "~/lib/tabsync";
import { kvDelete, kvList, kvSet } from "./kv";
import { STORE_RESUMES, getDB } from "./idb";
import { deleteLocalBlob, listLocalBlobs } from "./blobs";
import { hasResumeEntity, deleteResumeEntity } from "./resumes";
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
        const resumes = await new Promise<Resume[]>((resolve) => {
            const tx = db.transaction(STORE_RESUMES, "readonly");
            const store = tx.objectStore(STORE_RESUMES);
            const req = store.getAll();
            req.onsuccess = () => resolve((req.result || []) as Resume[]);
            req.onerror = () => resolve([]);
        });

        const now = Date.now();
        let deletedBlobs = 0;
        let deletedOrphanEntities = 0;
        const activeResumes: Resume[] = [];

        // 1. Detect and prune abandoned processing resumes
        for (const r of resumes) {
            if (r.status === "processing") {
                const lastActivity = r.heartbeatAt || r.updatedAt || r.processingStartedAt || 0;
                if (now - lastActivity >= gracePeriodMs) {
                    await deleteResumeEntity(r.id);
                    if (r.resumePath) {
                        const deleted = await deleteLocalBlob(r.resumePath).catch(() => false);
                        if (deleted) deletedBlobs++;
                    }
                    if (r.imagePath) {
                        const deleted = await deleteLocalBlob(r.imagePath).catch(() => false);
                        if (deleted) deletedBlobs++;
                    }
                    deletedOrphanEntities++;
                    continue;
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
                    await deleteLocalBlob(blob.path);
                    deletedBlobs++;
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
                return await kvSet(`resume:${r.id}`, JSON.stringify(buildResumeHeader(r)));
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
