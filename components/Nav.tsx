"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const tabs = [
  { href: "/publications", label: "Publications" },
  { href: "/poemes", label: "Poèmes" },
  { href: "/bibliotheque", label: "Bibliothèque" },
  { href: "/veille", label: "Veille" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="border-b" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
        <Link href="/publications" className="font-serif2 text-xl" style={{ color: "var(--gold)" }}>BVH</Link>
        <nav className="flex gap-4 flex-wrap text-sm">
          {tabs.map((t) => {
            const active = path?.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
                style={{ color: active ? "var(--ink)" : "var(--ink-dim)",
                  borderBottom: active ? "1px solid var(--gold)" : "1px solid transparent" }}>
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
