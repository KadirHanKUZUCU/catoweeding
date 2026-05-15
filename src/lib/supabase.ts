import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "Supabase: VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY .env dosyasında tanımlı olmalı.",
  );
}

export const supabase = createClient(url ?? "", key ?? "");
