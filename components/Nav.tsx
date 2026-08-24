"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Quatre onglets, rangés par moment de travail et non par table Supabase.
// Publications a fusionné dans l'Atelier (vue calendrier) : un poème programmé est le
// même objet vu plus tard. Cf. docs/specs/spec-refonte-ux-atelier-2026-08-23.md
const tabs = [
  { href: "/", label: "Accueil" },
  { href: "/atelier", label: "Atelier" },
  { href: "/ressources", label: "Ressources" },
  { href: "/veille", label: "Veille" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="border-b" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
        <Link href="/" className="font-serif2 text-xl" style={{ color: "var(--gold)" }}>BVH</Link>
        <nav className="flex gap-4 flex-wrap text-sm">
          {tabs.map((t) => {
            const active = t.href === "/" ? path === "/" : path?.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
                style={{ color: active ? "var(--ink)" : "var(--ink-dim)",
                  // L'onglet courant est une sélection, pas un titre : il passe en encre (lot 4).
                  borderBottom: active ? "1px solid var(--encre)" : "1px solid transparent" }}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <button className="ml-auto text-xs" style={{ color: "var(--ink-dim)" }}
          onClick={() => supabase.auth.signOut()}>déconnexion</button>
      </div>
    </header>
  );
}
