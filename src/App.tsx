import { Link, Outlet, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { CreateEventPage } from "./pages/CreateEventPage";
import { EventDashboardPage } from "./pages/EventDashboardPage";
import { EventGuestPage } from "./pages/EventGuestPage";
import { OrganizerEventsPage } from "./pages/OrganizerEventsPage";

function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-black/5 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            Dijital Anı
          </Link>
          <Link
            to="/hesabim"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sage)] hover:text-[var(--color-ink)]"
          >
            Etkinliklerim
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-black/5 bg-white/30 py-6 text-center text-xs text-black/45">
        <a
          href="https://kadirkuzucu.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-black/55 underline decoration-black/20 underline-offset-2 hover:text-[var(--color-ink)]"
        >
          Geliştirici Kado App
        </a>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/e/:slug" element={<EventGuestPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<CreateEventPage />} />
        <Route path="/hesabim" element={<OrganizerEventsPage />} />
        <Route path="/e/:slug/panel" element={<EventDashboardPage />} />
        <Route path="/e/:slug/yonetim/:token" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
