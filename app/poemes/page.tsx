"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const STATUSES: Record<string, string> = { idea: "idée", recorded: "enregistré", edited: "monté", scheduled: "programmé", published: "publié" };
const JOB_FR: Record<string, string> = { queued: "en file d'attente", running: "rendu en cours…", done: "terminé ✓", error: "erreur" };

export default function Poemes() {
  const [poems, setPoems] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [creating, setCreating] = useState(false);
  const [pAssets, setPAssets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [gen, setGen] = useState({ audio_asset_id: "", image_asset_id: "", style: "musee" });

  async function load() {
    const { data } = await supabase.from("poems").select("*").order("created_at", { ascending: false });
    setPoems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function loadPoemExtras(poemId: string) {
    const { data: a } = await supabase.from("assets").select("id, kind, title").eq("poem_id", poemId);
    setPAssets(a ?? []);
    const { data: j } = await supabase.from("render_jobs").select("*").eq("poem_id", poemId).order("created_at", { ascending: false }).limit(5);
    setJobs(j ?? []);
    const firstAudio = (a ?? []).find((x) => x.kind === "audio");
    const firstImage = (a ?? []).find((x) => x.kind === "image");
    setGen({ audio_asset_id: firstAudio?.id ?? "", image_asset_id: firstImage?.id ?? "", style: "musee" });
  }

  async function openPoem(p: any) {
    if (open === p.id) { setOpen(null); return; }
    setOpen(p.id); setDraft(p);
    loadPoemExtras(p.id);
  }

  async function save(id: string) {
    await supabase.from("poems").update({ title: draft.title, author: draft.author, source: draft.source, body: draft.body, status: draft.status, notes: draft.notes }).eq("id", id);
    setOpen(null); load();
  }

  async function create(e: any) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("poems").insert({ title: draft.title, author: draft.author, body: draft.body ?? "", created_by: user?.id });
    setCreating(false); setDraft({}); load();
  }

  async function launchRender(p: any) {
    if (!gen.audio_asset_id) { alert("Ajoute d'abord une bande son (lecture) liée à ce poème dans la Bibliothèque."); return; }
    if (!p.body?.trim()) { alert("Colle d'abord le texte du poème dans la fiche : il sert à générer les sous-titres."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("render_jobs").insert({
      poem_id: p.id, audio_asset_id: gen.audio_asset_id,
      image_asset_id: gen.image_asset_id || null, style: gen.style, created_by: user?.id,
    });
    if (error) alert(error.message); else loadPoemExtras(p.id);
  }

  const audios = pAssets.filter((a) => a.kind === "audio");
  const images = pAssets.filter((a) => a.kind === "image");

  return (
    <div>
      <div className="flex items-center mb-6">
        <h1 className="font-serif2 text-3xl">Poèmes</h1>
        <button className="btn ml-auto" onClick={() => { setCreating(!creating); setDraft({}); }}>+ Ajouter</button>
      </div>

      {creating && (
        <form onSubmit={create} className="card mb-6 grid gap-3">
          <input required placeholder="Titre" value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <input required placeholder="Auteur" value={draft.author ?? ""} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
          <textarea rows={6} placeholder="Texte du poème (édition de référence) — un vers par ligne" value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <button className="btn">Créer</button>
        </form>
      )}

      <div className="grid gap-3">
        {poems.map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-center gap-3 cursor-pointer flex-wrap" onClick={() => openPoem(p)}>
              <span className="font-serif2 text-xl">{p.title}</span>
              <span style={{ color: "var(--ink-dim)" }}>{p.author}</span>
              <span className="label ml-auto">{STATUSES[p.status]}</span>
            </div>
            {open === p.id && (
              <div className="grid gap-3 mt-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  <input value={draft.author ?? ""} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
                  <input placeholder="Source (recueil, année)" value={draft.source ?? ""} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
                  <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <textarea rows={8} placeholder="Texte du poème — un vers par ligne (sert aux sous-titres)" value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                <textarea rows={2} placeholder="Notes (tableau choisi, DA, remarques…)" value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                <div className="flex gap-3">
                  <button className="btn" onClick={() => save(p.id)}>Enregistrer</button>
                  <button className="btn2" onClick={() => setOpen(null)}>Fermer</button>
                </div>

                <div className="border-t pt-4 mt-2" style={{ borderColor: "var(--line)" }}>
                  <div className="label mb-3">Générer une vidéo</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div><div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Bande son</div>
                      <select value={gen.audio_asset_id} onChange={(e) => setGen({ ...gen, audio_asset_id: e.target.value })}>
                        <option value="">— aucune —</option>
                        {audios.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                      </select></div>
                    <div><div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Tableau (optionnel)</div>
                      <select value={gen.image_asset_id} onChange={(e) => setGen({ ...gen, image_asset_id: e.target.value })}>
                        <option value="">— fond généré —</option>
                        {images.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                      </select></div>
                    <div><div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Direction artistique</div>
                      <select value={gen.style} onChange={(e) => setGen({ ...gen, style: e.target.value })}>
                        <option value="musee">Musée (plein écran)</option>
                        <option value="galerie">Galerie (cadre doré)</option>
                      </select></div>
                  </div>
                  <button className="btn mt-3" onClick={() => launchRender(p)}>Générer la vidéo</button>
                  <p className="text-xs mt-2" style={{ color: "var(--ink-dim)" }}>
                    Le rendu tourne toutes les 30 min : transcription, sous-titres synchronisés sur le texte ci-dessus,
                    habillage, nappe musicale. Deux fichiers arrivent dans la Bibliothèque (avec musique / voix seule).
                  </p>
                  {jobs.length > 0 && (
                    <div className="mt-3 grid gap-1">
                      {jobs.map((j) => (
                        <div key={j.id} className="text-xs flex gap-3" style={{ color: j.status === "error" ? "#d65454" : "var(--ink-dim)" }}>
                          <span>{new Date(j.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>{j.style}</span><span>{JOB_FR[j.status]}</span>
                          {j.error && <span>· {j.error.slice(0, 120)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {poems.length === 0 && !creating && <p style={{ color: "var(--ink-dim)" }}>Aucun poème pour l'instant — ajoute le premier.</p>}
      </div>
    </div>
  );
}
