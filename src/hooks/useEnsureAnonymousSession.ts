import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";

export function useEnsureAnonymousSession() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.user?.id) {
        setUserId(data.session.user.id);
        setReady(true);
        return;
      }
      const { data: anon, error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("Misafir oturumu açılamadı: " + error.message, {
          description: "Supabase’de Anonymous sign-in açık mı kontrol edin. Sayfayı yenileyin.",
        });
        setReady(true);
        return;
      }
      setUserId(anon.user?.id ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, userId };
}
