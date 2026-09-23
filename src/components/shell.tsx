import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { TimeMachine } from "@/components/time-machine";
import { usePortfolio } from "@/lib/store";

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
  useEffect(() => {
    void usePortfolio.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-bone/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="font-display text-2xl text-ink italic">ProRent</span>
              <span className="text-xs font-medium tracking-caps text-copper">MAX</span>
            </Link>
            <p className="hidden text-xs text-stone sm:block">Коммерческая аренда · Европа</p>
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
