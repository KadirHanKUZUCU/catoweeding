import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryStorageProvider = "supabase" | "r2";

export function memoryStorageProvider(): MemoryStorageProvider {
  return import.meta.env.VITE_STORAGE_PROVIDER === "r2" ? "r2" : "supabase";
}

async function presignR2Upload(key: string, contentType: string): Promise<{ uploadUrl: string }> {
  const res = await fetch("/api/r2-presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "R2 yükleme adresi alınamadı.");
  }
  return (await res.json()) as { uploadUrl: string };
}

/** Yüklenen dosyanın DB'de saklanacak yolu. */
export async function uploadMemoryFile(
  supabase: SupabaseClient,
  file: File,
  relativePath: string,
  contentType: string,
): Promise<string> {
  if (memoryStorageProvider() === "r2") {
    const { uploadUrl } = await presignR2Upload(relativePath, contentType);
    const put = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!put.ok) throw new Error("Bulut depolamaya yükleme başarısız.");
    return `r2/${relativePath}`;
  }

  const { error } = await supabase.storage.from("memories").upload(relativePath, file, {
    upsert: false,
    contentType,
  });
  if (error) throw error;
  return relativePath;
}

export async function deleteMemoryPaths(supabase: SupabaseClient, paths: string[]) {
  const r2Keys: string[] = [];
  const supabasePaths: string[] = [];

  for (const raw of paths) {
    if (!raw) continue;
    if (raw.startsWith("r2/")) r2Keys.push(raw.slice(3));
    else supabasePaths.push(raw);
  }

  if (supabasePaths.length > 0) {
    await supabase.storage.from("memories").remove(supabasePaths);
  }

  if (r2Keys.length > 0) {
    await fetch("/api/r2-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: r2Keys }),
    });
  }
}
