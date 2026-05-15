import { nanoid } from "nanoid";

const KEY = "da_visitor_fp";

export function getOrCreateVisitorFingerprint(): string {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = nanoid(16);
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return nanoid(16);
  }
}
