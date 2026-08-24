"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, bucketFor } from "@/lib/supabase";
import Vivier from "@/components/Vivier";
import { fabriquerApercu, metaAvecApercu, metaAvecEchec } from "@/lib/vignette";

// Ressources — spec-vivier-visible-2026-08-24, lot 1.
//
// La page ne fait plus que trois choses : dire où on en est du stockage, accueillir le dépôt,
// et monter le vivier. Toute la liste, le classement et la fiche vivent dans `components/Vivier`,
// parce que l'Atelier monte le MÊME composant en mode sélection (lot 3). Deux implémentations
// du même vivier étaient précisément le défaut : filtrable là où on ne choisit pas, et réduit à
// un menu de noms de fichiers là où le choix se fait.

const PLAFOND_TOTAL = 1_000_000_000;   // 1 Go, plan Supabase Free — rien ne purge.
const PLAFOND_FICHIER = 50_000_000;    // 50 Mo par fichier, même plan.

const mo = (n: number) => (n / 1e6).toFixed(0) + " Mo";

// Le type se déduit du fichier. Une vidéo est un métrage par défaut : c'est le cas le plus
// fréquent, et le reclassement est à un clic dans la fiche.
function kindFor(f: File) {
  if (f.type.startsWith("video/")) return "broll";
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("audio/")) return "music";
  return "image";
}

export default function Ressources() {
  const [total, setTotal] = useState(0);
  const [nb, setNb] = useState(0);
  const [queue, setQueue] = useState<{ name: string; state: string; msg?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rafraichir, setRafraichir] = useState(0);
  const zone = useRef<HTMLDivElement | null>(null);

  // Requête volontairement maigre : la page n'a besoin que du quota. Les vignettes pèsent ~8 Ko
  // par ligne et n'ont rien à faire ici — c'est le vivier qui les charge.
  const quota = useCallback(async () => {
    const { data } = await supabase.from("assets").select("size_bytes");
    setTotal((data ?? []).reduce((s: number, a: any) => s + (a.size_bytes ?? 0), 0));
    setNb((data ?? []).length);
  }, []);
  useEffect(() => { quota(); }, [quota, rafraichir]);

  const reste = Math.max(0, PLAFOND_TOTAL - total);
  const part = Math.min(100, Math.round((total / PLAFOND_TOTAL) * 100));
  const haut = part >= 90;

  async function uploadAll(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    setQueue(files.map((f) => ({ name: f.name, state: "attente" })));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const majPos = (x: any) => setQueue((qq) => qq.map((y, j) => (j === i ? { ...y, ...x } : y)));

      // Refus AVANT envoi. Le message dit le poids et la limite, pas « erreur ».
      // (Le contrôle complet — type, quota restant, total — est le lot 2 ; celui-ci est le
      // plus coûteux à découvrir après coup.)
      if (file.size > PLAFOND_FICHIER) {
        majPos({ state: "refusé", msg: `${(file.size / 1e6).toFixed(0)} Mo, la limite est de 50 Mo par fichier.` });
        continue;
      }

      majPos({ state: "envoi" });
      const k = kindFor(file);
      const bucket = k === "music" ? "audios" : bucketFor(file.type);
      const path = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) { majPos({ state: "erreur", msg: error.message }); continue; }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: ins, error: e2 } = await supabase.from("assets").insert({
        poem_id: null, kind: k, title: file.name, storage_bucket: bucket, storage_path: path,
        mime_type: file.type, size_bytes: file.size, created_by: user?.id,
      }).select("id, meta").single();
      if (e2 || !ins) { majPos({ state: "erreur", msg: e2?.message }); continue; }

      // L'aperçu se fabrique ICI, sur le fichier qu'on a déjà en main : pas de re-téléchargement,
      // pas de canvas « tainté » par une autre origine, et plus jamais de requête de stockage
      // pour afficher la liste.
      try {
        const apercu = await fabriquerApercu(file, k);
        await supabase.from("assets").update({ meta: metaAvecApercu(ins.meta, apercu) }).eq("id", ins.id);
      } catch {
        await supabase.from("assets").update({ meta: metaAvecEchec(ins.meta) }).eq("id", ins.id);
      }
      majPos({ state: "ok" });
    }

    setBusy(false);
    setRafraichir((n) => n + 1);
    setTimeout(() => setQueue((q) => (q.some((x) => x.state === "refusé" || x.state === "erreur") ? q : [])), 4000);
  }

  return (
    <div ref={zone}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); uploadAll(Array.from(e.dataTransfer.files)); }}
    >
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="font-serif2 text-3xl">Ressources</h1>
        <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {nb} fichier{nb > 1 ? "s" : ""} · 50 Mo maximum par fichier
        </span>
        <label className="btn text-xs cursor-pointer ml-auto">
          {busy ? "envoi…" : "+ Déposer"}
          <input type="file" multiple disabled={busy} style={{ display: "none" }}
            onChange={(e) => { uploadAll(Array.from(e.target.files ?? [])); e.currentTarget.value = ""; }} />
        </label>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--ink-dim)" }}>
        Dépose, puis classe. La voix d&apos;un poème se dépose sur sa fiche, dans l&apos;Atelier.
      </p>

      {/* La jauge dit ce qui RESTE, pas seulement ce qui est pris : c'est la seule des deux
          informations sur laquelle on peut agir. Rien ne purge automatiquement. */}
      <div className="card mb-4" style={{ padding: 12 }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="label">Stockage</span>
          <span className="text-sm">{mo(total)} sur 1 Go</span>
          <span className="text-xs ml-auto" style={{ color: haut ? "var(--danger)" : "var(--ink-dim)" }}>
            {mo(reste)} restants
            {haut && reste < PLAFOND_FICHIER ? " — plus assez pour un fichier de 50 Mo." : ""}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--bg)", border: "1px solid var(--line)", marginTop: 8 }}>
          <div style={{ width: `${part}%`, height: "100%", borderRadius: 999, background: haut ? "var(--danger)" : "var(--encre)" }} />
        </div>
      </div>

      {err && <div className="card mb-3" role="alert" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{err}</div>}

      {queue.length > 0 && (
        <div className="card mb-4 grid gap-1" aria-live="polite">
          {queue.map((it, i) => (
            <div key={i} className="flex gap-3 text-xs items-baseline">
              <span style={{
                width: 78, flexShrink: 0,
                color: it.state === "ok" ? "var(--encre)"
                  : it.state === "erreur" || it.state === "refusé" ? "var(--danger)" : "var(--ink-dim)",
              }}>
                {it.state === "ok" ? "envoyé ✓" : it.state === "envoi" ? "envoi…" : it.state === "attente" ? "en attente" : it.state}
              </span>
              <span className="truncate">{it.name}</span>
              {it.msg && <span style={{ color: "var(--danger)" }}>· {it.msg}</span>}
            </div>
          ))}
        </div>
      )}

      <Vivier mode="gestion" rafraichir={rafraichir} />

      {over && (
        <div className="mt-3 rounded-xl text-center font-serif2 text-xl"
          style={{ border: "1px dashed var(--encre)", padding: 24, color: "var(--encre)" }}>
          Lâche pour déposer
        </div>
      )}
    </div>
  );
}
