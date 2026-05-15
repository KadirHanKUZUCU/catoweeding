import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

export type MediaLightboxState =
  | null
  | { kind: "image"; url: string; title: string }
  | { kind: "video"; url: string; title: string }
  | { kind: "info"; title: string; body: string };

export function MediaLightbox(props: { state: MediaLightboxState; onClose: () => void }) {
  const { state, onClose } = props;

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!state) return;
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [state, onKey]);

  if (!state) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Önizleme"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[min(96vw,900px)] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-black shadow"
          onClick={onClose}
        >
          Kapat
        </button>
        <p className="truncate px-4 pb-2 pt-3 text-center text-xs text-white/70">{state.title}</p>
        <div className="px-3 pb-4">
          {state.kind === "image" ? (
            <img src={state.url} alt="" className="max-h-[80vh] w-auto max-w-full object-contain" />
          ) : state.kind === "video" ? (
            <video src={state.url} className="max-h-[80vh] w-full max-w-full" controls playsInline autoPlay />
          ) : (
            <p className="max-w-md px-2 py-6 text-center text-sm leading-relaxed text-white/90">{state.body}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
