import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteMemoryPaths, uploadMemoryFile } from "./memoryStorage";

export type GuestMemorySubmitInput = {
  supabase: SupabaseClient;
  eventId: string;
  userId: string;
  fullName: string;
  noteTrimmed: string | null;
  photoFiles: File[];
  videoFiles: File[];
};

/** Kısmi hata sonrası yüklenen dosyaları ve DB satırlarını temizler. */
async function rollbackPartialSubmit(
  supabase: SupabaseClient,
  paths: string[],
  memoryIds: string[],
) {
  if (memoryIds.length > 0) {
    await supabase.from("memories").delete().in("id", memoryIds);
  }
  if (paths.length > 0) {
    await deleteMemoryPaths(supabase, paths);
  }
}

/** Sunucuya yükleme + memories satırları (misafir formu ve çevrimdışı kuyruk ortak). */
export async function submitGuestMemories(inp: GuestMemorySubmitInput): Promise<{
  photoRows: number;
  videoRows: number;
  noteOnly: boolean;
}> {
  const { supabase, eventId, userId, fullName, noteTrimmed, photoFiles, videoFiles } = inp;
  const nPhotos = photoFiles.length;
  const nVideos = videoFiles.length;
  const uploadedPaths: string[] = [];
  const insertedIds: string[] = [];

  try {
    if (nPhotos === 0 && nVideos === 0 && noteTrimmed) {
      const { data, error: ins } = await supabase
        .from("memories")
        .insert({
          event_id: eventId,
          owner_id: userId,
          full_name: fullName,
          note: noteTrimmed,
          photo_path: null,
          video_path: null,
        })
        .select("id")
        .single();
      if (ins) throw ins;
      if (data) insertedIds.push(data.id);
      return { photoRows: 0, videoRows: 0, noteOnly: true };
    }

    let noteAttached = false;

    for (const file of photoFiles) {
      const folder = nanoid();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const relativePath = `${eventId}/${folder}/photo.${ext}`;
      const storedPath = await uploadMemoryFile(
        supabase,
        file,
        relativePath,
        file.type || "image/jpeg",
      );
      uploadedPaths.push(storedPath);

      const rowNote = !noteAttached && noteTrimmed ? noteTrimmed : null;
      if (rowNote) noteAttached = true;

      const { data, error: ins } = await supabase
        .from("memories")
        .insert({
          event_id: eventId,
          owner_id: userId,
          full_name: fullName,
          note: rowNote,
          photo_path: storedPath,
          video_path: null,
        })
        .select("id")
        .single();
      if (ins) throw ins;
      if (data) insertedIds.push(data.id);
    }

    for (const file of videoFiles) {
      const folder = nanoid();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const relativePath = `${eventId}/${folder}/video.${ext}`;
      const storedPath = await uploadMemoryFile(
        supabase,
        file,
        relativePath,
        file.type || "video/mp4",
      );
      uploadedPaths.push(storedPath);

      const rowNote = !noteAttached && noteTrimmed ? noteTrimmed : null;
      if (rowNote) noteAttached = true;

      const { data, error: ins } = await supabase
        .from("memories")
        .insert({
          event_id: eventId,
          owner_id: userId,
          full_name: fullName,
          note: rowNote,
          photo_path: null,
          video_path: storedPath,
        })
        .select("id")
        .single();
      if (ins) throw ins;
      if (data) insertedIds.push(data.id);
    }

    return { photoRows: nPhotos, videoRows: nVideos, noteOnly: false };
  } catch (err) {
    await rollbackPartialSubmit(supabase, uploadedPaths, insertedIds);
    throw err;
  }
}
