import { openDB, type IDBPDatabase } from "idb";

/**
 * Local drafts, for crash recovery only.
 *
 * Nothing here ever touches the network. A draft exists so a crashed tab or an
 * accidental reload does not lose work that was never saved; the database still
 * only receives a write when the user presses Save.
 */

export type Draft = {
  text: string;
  savedAt: number;
  baseRevision: number;
};

const DB_NAME = "nested";
const STORE = "drafts";

let connection: Promise<IDBPDatabase> | null = null;

function database() {
  if (!connection) {
    connection = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
  }
  return connection;
}

function key(userId: string, fileId: string) {
  return `${userId}:${fileId}`;
}

export async function getDraft(userId: string, fileId: string): Promise<Draft | null> {
  try {
    const db = await database();
    return (await db.get(STORE, key(userId, fileId))) ?? null;
  } catch {
    return null;
  }
}

export async function putDraft(
  userId: string,
  fileId: string,
  draft: Draft,
): Promise<void> {
  try {
    const db = await database();
    await db.put(STORE, draft, key(userId, fileId));
  } catch {
    // A full or blocked IndexedDB must not break typing.
  }
}

export async function deleteDraft(userId: string, fileId: string): Promise<void> {
  try {
    const db = await database();
    await db.delete(STORE, key(userId, fileId));
  } catch {
    /* ignore */
  }
}

/** Drops every draft belonging to a user, used on explicit sign-out. */
export async function clearDrafts(userId: string): Promise<void> {
  try {
    const db = await database();
    const keys = await db.getAllKeys(STORE);
    const mine = keys.filter((entry) => String(entry).startsWith(`${userId}:`));
    await Promise.all(mine.map((entry) => db.delete(STORE, entry)));
  } catch {
    /* ignore */
  }
}
