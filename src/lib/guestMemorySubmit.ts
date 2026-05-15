import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GuestMemorySubmitInput = {
  supabase: SupabaseClient;
  eventId: string;
  userId: string;
  fullName: string;
  noteTrimmed: string | null;
  photoFiles: File[];
  videoFiles: File[];
};

/** Sunucuya yükleme + memories satırları (misafir formu ve çevrimdışı kuyruk ortak). */
export async function submitGuestMemories(inp: GuestMemorySubmitInput): Promise<{
  photoRows: number;
  videoRows: number;
  noteOnly: boolean;
}> {
  const { supabase, eventId, userId, fullName, noteTrimmed, photoFiles, videoFiles } = inp;
  const nPhotos = photoFiles.length;
  const nVideos = videoFiles.length;

  if (nPhotos === 0 && nVideos === 0 && noteTrimmed) {
    const { error: ins } = await supabase.from("memories").insert({
      event_id: eventId,
      owner_id: userId,
      full_name: fullName,
      note: noteTrimmed,
      photo_path: null,
      video_path: null,
    });
    if (ins) throw ins;
    return { photoRows: 0, videoRows: 0, noteOnly: true };
  }

  for (const file of photoFiles) {
    const folder = nanoid();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const photoPath = `${eventId}/${folder}/photo.${ext}`;
    const { error: pErr } = await supabase.storage.from("memories").upload(photoPath, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (pErr) throw pErr;

    const { error: ins } = await supabase.from("memories").insert({
      event_id: eventId,
      owner_id: userId,
      full_name: fullName,
      note: noteTrimmed,
      photo_path: photoPath,
      video_path: null,
    });
    if (ins) throw ins;
  }

  for (const file of videoFiles) {
    const folder = nanoid();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const videoPath = `${eventId}/${folder}/video.${ext}`;
    const { error: vErr } = await supabase.storage.from("memories").upload(videoPath, file, {
      upsert: true,
      contentType: file.type || "video/mp4",
    });
    if (vErr) throw vErr;

    const { error: ins } = await supabase.from("memories").insert({
      event_id: eventId,
      owner_id: userId,
      full_name: fullName,
      note: noteTrimmed,
      photo_path: null,
      video_path: videoPath,
    });
    if (ins) throw ins;
  }

  return { photoRows: nPhotos, videoRows: nVideos, noteOnly: false };
}
