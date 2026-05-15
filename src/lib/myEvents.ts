const STORAGE_KEY = "dijital_ani_my_events";

export type SavedEvent = {
  slug: string;
  admin_token: string;
  couple_names: string;
  created_at: string;
};

export function readMyEvents(): SavedEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedEvent =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as SavedEvent).slug === "string" &&
        typeof (x as SavedEvent).admin_token === "string" &&
        typeof (x as SavedEvent).couple_names === "string" &&
        typeof (x as SavedEvent).created_at === "string",
    );
  } catch {
    return [];
  }
}

export function rememberEvent(ev: SavedEvent): void {
  const rest = readMyEvents().filter((e) => e.slug !== ev.slug);
  const next = [ev, ...rest].slice(0, 40);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function forgetEvent(slug: string): void {
  const next = readMyEvents().filter((e) => e.slug !== slug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getStoredAdminToken(slug: string): string {
  const fromSession = sessionStorage.getItem(`admin:${slug}`) ?? "";
  if (fromSession) return fromSession;
  const ev = readMyEvents().find((e) => e.slug === slug);
  return ev?.admin_token ?? "";
}
