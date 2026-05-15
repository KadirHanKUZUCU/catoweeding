import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { nanoid } from "nanoid";

const DB_NAME = "dijital-ani-offline";
const STORE = "pending";

interface OfflineSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: {
      id: string;
      eventId: string;
      userId: string;
      fullName: string;
      note: string | null;
      photos: { name: string; type: string; data: ArrayBuffer }[];
      videos: { name: string; type: string; data: ArrayBuffer }[];
      createdAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineSchema>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineGuestSubmit(payload: {
  eventId: string;
  userId: string;
  fullName: string;
  note: string | null;
  photoFiles: File[];
  videoFiles: File[];
}): Promise<string> {
  const id = nanoid();
  const photos: { name: string; type: string; data: ArrayBuffer }[] = [];
  const videos: { name: string; type: string; data: ArrayBuffer }[] = [];
  for (const f of payload.photoFiles) {
    photos.push({ name: f.name, type: f.type || "application/octet-stream", data: await f.arrayBuffer() });
  }
  for (const f of payload.videoFiles) {
    videos.push({ name: f.name, type: f.type || "application/octet-stream", data: await f.arrayBuffer() });
  }
  const db = await getDb();
  await db.put(STORE, {
    id,
    eventId: payload.eventId,
    userId: payload.userId,
    fullName: payload.fullName,
    note: payload.note,
    photos,
    videos,
    createdAt: Date.now(),
  });
  return id;
}

export async function listOfflineGuestSubmits(): Promise<OfflineSchema[typeof STORE]["value"][]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function removeOfflineGuestSubmit(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export function filesFromOffline(row: OfflineSchema[typeof STORE]["value"]): {
  photoFiles: File[];
  videoFiles: File[];
} {
  const photoFiles = row.photos.map(
    (p) => new File([p.data], p.name, { type: p.type || "image/jpeg", lastModified: row.createdAt }),
  );
  const videoFiles = row.videos.map(
    (p) => new File([p.data], p.name, { type: p.type || "video/mp4", lastModified: row.createdAt }),
  );
  return { photoFiles, videoFiles };
}
