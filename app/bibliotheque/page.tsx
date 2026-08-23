"use client";
import { useEffect, useState } from "react";
import { supabase, bucketFor } from "@/lib/supabase";

const KIND_LABEL: Record<string, string> = { video: "Vidéos", audio: "Voix", music: "Bandes son", image: "Images" };
// Un asset orphelin est introuvable depuis la fiche du poème : on exige le lien
// pour tout ce que le rendu consomme. Seule la musique peut resservir ailleurs.
const POEM_REQUIRED = ["video", "audio", "image"];

type Item = { name: string; state: "attente" | "envoi" | "ok" | "erreur"; msg?: string };

export default function Bibliotheque() {
  const [assets, setAssets] = useState<any[]>([]);
  const [poems, setPoems] = useState<any[]>([]);
  const [poemId, setPoemId] = useState("");
  const [kind, setKind] = useState("video");
  const [queue, setQueue] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const needsPoem = POEM_REQUIRED.includes(kind);
  const bloque = needsPoem && !poemId;

  async function load() {
    const { data, error } = await supabase.from("assets").select("*, poems(title)").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setErr(null);
    setAssets(data ?? []);
    const { data: p } = await supabase.from("poems").select("id, title").order("created_at", { ascending: false });
    setPoems(p ?? []);
  }
  useEffect(() => { load(); }, []);

  // Le type est déduit du fichier quand c'est sans ambiguïté. Un fichier audio peut être
  // une lecture ou une bande son : là, seul le choix du menu tranche.
  function kindFor(file: File) {
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("audio/")) return kind === "music" ? "music" : "audio";
    return kind;
  }

  async function uploadAll(files: File[]) {
    if (!files.length || bloque) return;
    setBusy(true);
    setQueue(files.map((f) => ({ name: f.name, state: "attente" })));
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: "envoi" } : x)));
      const k = kindFor(file);
      const bucket = k === "music" || k === "audio" ? "audios" : bucketFor(file.type);
      const path = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) {
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: "erreur", msg: error.message } : x)));
        continue;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error: e2 } = await supabase.from("assets").insert({
        poem_id: poemId || null, kind: k, title: file.name, storage_bucket: bucket, storage_path: path,
        mime_type: file.type, size_bytes: file.size, created_by: user?.id,
      });
      setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: e2 ? "erreur" : "ok", msg: e2?.message } : x)));
    }
    setBusy(false);
    load();
    setTimeout(() => setQueue([]), 4000);
  }

  async function download(a: any) {
    const { data } = await supabase.storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(a: any) {
    await supabase.storage.from(a.storage_bucket).remove([a.storage_path]);
    await supabase.from("assets").delete().eq("id", a.id);
    setConfirmId(null);
    load();
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!bloque) setOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); uploadAll(Array.from(e.dataTransfer.files)); }}
    >
      <h1 className="font-serif2 text-3xl mb-6">Bibliothèque</h1>
      {err && <div className="card mb-6" style={{ borderColor: "#d65454", color: "#d65454" }}>Erreur : {err}</div>}

      <div className="card mb-4 grid gap-3 md:grid-cols-2">
        <div><div className="label mb-1">Type par défaut</div>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="video">Vidéo montée</option><option value="audio">Voix (lecture)</option>
            <option value="music">Bande son</option><option value="image">Image / tableau</option>
          </select>
          <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
            Vidéos et images sont reconnues toutes seules. Ce choix ne sert qu'à distinguer
            une voix d'une bande son.
          </p></div>
        <div><div className="label mb-1">Poème lié {needsPoem ? "" : "(optionnel)"}</div>
          <select value={poemId} onChange={(e) => setPoemId(e.target.value)}
            style={bloque ? { borderColor: "var(--gold)" } : undefined}>
            <option value="">—</option>
            {poems.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          {bloque && <p className="text-xs mt-1" style={{ color: "var(--gold)" }}>Choisis d'abord le poème lié.</p>}</div>
      </div>

      <label className="block mb-8 rounded-xl text-center cursor-pointer transition-colors"
        style={{
          border: `1px dashed ${over ? "var(--gold)" : "var(--line)"}`,
          background: over ? "rgba(201,164,92,.06)" : "var(--panel)",
          padding: "34px 20px", opacity: bloque ? .45 : 1,
          cursor: bloque ? "not-allowed" : "pointer",
        }}>
        <input type="file" multiple disabled={busy || bloque} className="hidden"
          style={{ display: "none" }}
          onChange={(e) => { uploadAll(Array.from(e.target.files ?? [])); e.currentTarget.value = ""; }} />
        <div className="font-serif2 text-xl mb-1">
          {busy ? "Envoi en cours…" : "Dépose tes fichiers ici"}
        </div>
        <div className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {bloque ? "Choisis le poème lié pour activer le dépôt" : "ou clique pour les choisir — plusieurs à la fois"}
        </div>
      </label>

      {queue.length > 0 && (
        <div className="card mb-8 grid gap-1">
          {queue.map((it, i) => (
            <div key={i} className="flex gap-3 text-xs items-center">
              <span style={{
                color: it.state === "ok" ? "var(--gold)" : it.state === "erreur" ? "#d65454" : "var(--ink-dim)",
                width: 74, flexShrink: 0,
              }}>
                {it.state === "ok" ? "envoyé ✓" : it.state === "erreur" ? "erreur" : it.state === "envoi" ? "envoi…" : "en attente"}
              </span>
              <span style={{ color: "var(--ink)" }}>{it.name}</span>
              {it.msg && <span style={{ color: "#d65454" }}>· {it.msg}</span>}
            </div>
          ))}
        </div>
      )}

      {["video", "audio", "music", "image"].map((k) => {
        const list = assets.filter((a) => a.kind === k);
        if (!list.length) return null;
        return (
          <div key={k} className="mb-6">
            <div className="label mb-2">{KIND_LABEL[k]}</div>
            <div className="grid gap-2">
              {list.map((a) => (
                <div key={a.id} className="card flex items-center gap-3 py-3 flex-wrap">
                  <span className="text-sm">{a.title}</span>
                  {a.poems?.title && <span className="text-xs" style={{ color: "var(--gold)" }}>{a.poems.title}</span>}
                  <span className="text-xs ml-auto" style={{ color: "var(--ink-dim)" }}>{a.size_bytes ? (a.size_bytes / 1e6).toFixed(1) + " Mo" : ""}</span>
                  <button className="btn2 text-xs" onClick={() => download(a)}>télécharger</button>
                  {confirmId === a.id
                    ? <button className="btn2 text-xs" style={{ color: "#d65454", borderColor: "#d65454" }}
                        onClick={() => remove(a)}>confirmer ?</button>
                    : <button className="btn2 text-xs" onClick={() => setConfirmId(a.id)}>✕</button>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {assets.length === 0 && <p style={{ color: "var(--ink-dim)" }}>Rien pour l'instant — dépose tes vidéos, voix, bandes sons et tableaux.</p>}
    </div>
  );
}
