export interface FSItem {
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

export interface KVItem {
    key: string;
    value: string;
}
