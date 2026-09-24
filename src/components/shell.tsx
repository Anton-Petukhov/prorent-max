import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TimeMachine } from "@/components/time-machine";
import { usePortfolio } from "@/lib/store";

const THEME_KEY = "prorent-theme";
const ANTHRACITE = "#383e42";

const LINKS = [
  { to: "/", label: "Обзор" },
  { to: "/portfolio", label: "Портфель" },
  { to: "/analytics", label: "Аналитика" },
  { to: "/stack", label: "Шахматка" },
  { to: "/documents", label: "Документы" },
  { to: "/plans", label: "Планы 3D" },
  { to: "/brand-hall", label: "Брэнд Холл" },
  { to: "/pioneer", label: "Пионер" },
  { to: "/electron", label: "Электрон" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    void usePortfolio.persist.rehydrate();
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem(THEME_KEY, next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#2b3034" : "#efeae2");
    setDark(next === "dark");
  }

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-bone/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="font-display text-2xl text-ink italic">ProRent</span>
              <span className="text-xs font-medium tracking-caps text-copper">MAX</span>
            </Link>
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-stone sm:block">Коммерческая аренда · Европа</p>
              <button
                type="button"
                aria-pressed={dark}
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 border border-line bg-paper px-3 py-1.5 text-sm text-ink"
              >
                <span className="size-3 shrink-0" style={{ background: dark ? "#efeae2" : ANTHRACITE }} />
                {dark ? "Светлая" : "Тёмная"}
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: true }}
                className="shrink-0 border-b-2 border-transparent px-2 py-2 text-sm text-stone hover:text-ink data-[status=active]:border-copper data-[status=active]:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-44 sm:px-6">{children}</main>
      <TimeMachine />
    </div>
  );
}
