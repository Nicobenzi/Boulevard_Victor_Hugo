"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const tabs = [
  { href: "/calendrier", label: "Calendrier" },
  { href: "/publier", label: "À publier" },
  { href: "/poemes", label: "Poèmes" },
  { href: "/bibliotheque", label: "Bibliothèque" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="border-b" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
        <Link href="/calendrier" className="font-serif2 text-xl" style={{ color: "var(--gold)" }}>BVH</Link>
        <nav className="flex gap-4 flex-wrap text-sm">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href}
              style={{ color: path?.startsWith(t.href) ? "var(--ink)" : "var(--ink-dim)",
                borderBottom: path?.startsWith(t.href) ? "1px solid var(--gold)" : "1px solid transparent" }}>
              {t.label}
            </Link>
          ))}
        </nav>
        <button className="ml-auto text-xs" style={{ color: "var(--ink-dim)" }}
          onClick={() => supabase.auth.signOut()}>déconnexion</button>
      </div>
    </header>
  );
}
