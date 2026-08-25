"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "anon" | "member" | "forbidden">("loading");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function check() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setState("anon"); return; }
    const { data: prof } = await supabase.from("profiles").select("id").eq("id", session.user.id).maybeSingle();
    setState(prof ? "member" : "forbidden");
  }

  useEffect(() => {
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === "loading") return <div className="p-10 text-center" style={{ color: "var(--ink-dim)" }}>…</div>;

  if (state === "anon" || state === "forbidden")
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card w-full max-w-sm text-center">
          <h1 className="font-serif2 text-3xl mb-1">Novalis</h1>
          <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>Le studio</p>
          {state === "forbidden" ? (
            <p className="text-sm">Ce compte n'est pas autorisé. Demande à être ajouté à la liste des membres, puis reconnecte-toi.</p>
          ) : sent ? (
            <p className="text-sm">Lien envoyé — vérifie ta boîte mail et clique pour entrer.</p>
          ) : (
            <form onSubmit={async (e) => { e.preventDefault();
              await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined } });
              setSent(true); }}>
              <input type="email" required placeholder="ton@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-3" />
              <button className="btn w-full">Recevoir le lien de connexion</button>
            </form>
          )}
        </div>
      </div>
    );

  return <>{children}</>;
}
