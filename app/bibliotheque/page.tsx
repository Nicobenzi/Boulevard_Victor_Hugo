"use client";
import { useEffect, useState } from "react";
import { supabase, bucketFor } from "@/lib/supabase";

const KIND_LABEL: Record<string, string> = { video: "Vidéos", audio: "Voix", music: "Musiques", image: "Images" };

export default function Bibliotheque() {
  const [assets, setAssets] = useState<any[]>([]);
  const [poems, setPoems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [poemId, setPoemId] = useState("");
  const [kind, setKind] = useState("video");

  async function load() {
    const { data } = await supabase.from("assets").select("*, poems(title)").order("created_at", { ascending: false });
    setAssets(data ?? []);
    const { data: p } = await supabase.from("poems").select("id, title").order("created_at", { ascending: false });
    setPoems(p ?? []);
  }
  useEffect(() => { load(); }, []);

  async function upload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const bucket = kind === "music" || kind === "audio" ? "audios" : bucketFor(file.type);
    const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("assets").insert({
        poem_id: poemId || null, kind, title: file.name, storage_bucket: bucket, storage_path: path,
        mime_type: file.type, size_bytes: file.size, created_by: user?.id,
      });
    } else alert("Erreur d'upload : " + error.message);
    setUploading(false); e.target.value = ""; load();
  }

  async function download(a: any) {
    const { data } = await supabase.storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(a: any) {
    if (!confirm(`Supprimer « ${a.title} » ?`)) return;
    await supabase.storage.from(a.storage_bucket).remove([a.storage_path]);
    await supabase.from("assets").delete().eq("id", a.id);
    load();
  }

  return (
    <div>
      <h1 className="font-serif2 text-3xl mb-6">Bibliothèque</h1>
      <div className="card mb-8 grid gap-3 md:grid-cols-3">
        <div><div className="label mb-1">Type</div>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="video">Vidéo montée</option><option value="audio">Voix (lecture)</option>
            <option value="music">Bande son</option><option value="image">Image / tableau</option>
          </select></div>
        <div><div className="label mb-1">Poème lié (optionnel)</div>
          <select value={poemId} onChange={(e) => setPoemId(e.target.value)}>
            <option value="">—</option>
            {poems.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select></div>
        <div><div className="label mb-1">Fichier</div>
          <input type="file" onChange={upload} disabled={uploading} />
          {uploading && <p className="text-xs mt-1" style={{ color: "var(--gold)" }}>envoi en cours…</p>}</div>
      </div>

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
                  <button className="btn2 text-xs" onClick={() => remove(a)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {assets.length === 0 && <p style={{ color: "var(--ink-dim)" }}>Rien pour l'instant — dépose vos vidéos, voix, bandes sons et tableaux.</p>}
    </div>
  );
}
